import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/backfill-contacts
 * Tworzy brakujace rekordy contacts dla userow z rola "client"
 */
export const POST = withAuth("admin", async (_request, { user }) => {
  const adminClient = createAdminClient();
  console.log("[BACKFILL] start — user=%s", user.id);

  const { data: clientUsers } = await adminClient
    .from("users")
    .select("id, full_name, phone")
    .eq("role", "client");

  console.log("[BACKFILL] clientUsers=%d", clientUsers?.length ?? 0);
  if (!clientUsers || clientUsers.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, message: "Brak userow z rola client" });
  }

  const { data: existingContacts } = await adminClient
    .from("contacts")
    .select("user_id")
    .not("user_id", "is", null);

  const existingUserIds = new Set(
    (existingContacts ?? []).map((c) => c.user_id)
  );

  const missingUsers = clientUsers.filter((u) => !existingUserIds.has(u.id));
  console.log("[BACKFILL] missing=%d, existing=%d", missingUsers.length, existingUserIds.size);

  if (missingUsers.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: clientUsers.length,
      message: "Wszyscy klienci maja juz contacts",
    });
  }

  const { data: authData } = await adminClient.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });

  const toInsert = missingUsers.map((u) => ({
    user_id: u.id,
    full_name: u.full_name,
    email: emailMap.get(u.id) ?? null,
    phone: u.phone ?? null,
  }));

  const { error } = await adminClient.from("contacts").insert(toInsert);

  if (error) {
    console.error("[BACKFILL] insert error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  console.log("[BACKFILL] done — created=%d, skipped=%d", toInsert.length, clientUsers.length - toInsert.length);
  return NextResponse.json({
    created: toInsert.length,
    skipped: clientUsers.length - toInsert.length,
  });
});
