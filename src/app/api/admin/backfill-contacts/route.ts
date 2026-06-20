import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/backfill-contacts
 * Tworzy brakujace rekordy contacts dla userow z rola "client"
 * ktorzy nie maja powiazanego kontaktu (user_id w contacts).
 * Admin only.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  console.log("[BACKFILL] start — user=%s", user.id);

  // 1. Pobierz wszystkich userow z rola "client"
  const { data: clientUsers } = await adminClient
    .from("users")
    .select("id, full_name, phone")
    .eq("role", "client");

  console.log("[BACKFILL] clientUsers=%d", clientUsers?.length ?? 0);
  if (!clientUsers || clientUsers.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0, message: "Brak userow z rola client" });
  }

  // 2. Pobierz contacts ktore JUZ maja user_id
  const { data: existingContacts } = await adminClient
    .from("contacts")
    .select("user_id")
    .not("user_id", "is", null);

  const existingUserIds = new Set(
    (existingContacts ?? []).map((c) => c.user_id)
  );

  // 3. Filtruj userow bez contacts
  const missingUsers = clientUsers.filter((u) => !existingUserIds.has(u.id));
  console.log("[BACKFILL] missing=%d, existing=%d", missingUsers.length, existingUserIds.size);

  if (missingUsers.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: clientUsers.length,
      message: "Wszyscy klienci maja juz contacts",
    });
  }

  // 4. Pobierz emaile z auth
  const { data: authData } = await adminClient.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });

  // 5. Batch INSERT
  const toInsert = missingUsers.map((u) => ({
    user_id: u.id,
    full_name: u.full_name,
    email: emailMap.get(u.id) ?? null,
    phone: u.phone ?? null,
  }));

  const { error } = await adminClient.from("contacts").insert(toInsert);

  if (error) {
    console.error("[BACKFILL] insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[BACKFILL] done — created=%d, skipped=%d", toInsert.length, clientUsers.length - toInsert.length);
  return NextResponse.json({
    created: toInsert.length,
    skipped: clientUsers.length - toInsert.length,
  });
}
