import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/users/[id] — edycja użytkownika (admin only)
 */
export const PATCH = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  console.log("[USER PATCH] userId=%s body=%j", id, body);

  if (body.fullName !== undefined) updateData.full_name = body.fullName;
  if (body.role !== undefined) {
    if (!["admin", "operator", "client"].includes(body.role as string)) {
      return NextResponse.json({ error: "Nieprawidłowa rola" }, { status: 400 });
    }
    updateData.role = body.role;
  }
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.isActive !== undefined) updateData.is_active = body.isActive;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
  }

  let oldRole: string | null = null;
  if (body.role !== undefined) {
    const { data: oldProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", id)
      .single();
    oldRole = oldProfile?.role ?? null;
  }

  const { error } = await supabase.from("users").update(updateData).eq("id", id);

  if (error) {
    console.error("[USERS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  // Synchronizacja contacts przy zmianie roli
  if (body.role !== undefined && oldRole && oldRole !== body.role) {
    console.log("[USER PATCH] zmiana roli: %s → %s (userId=%s)", oldRole, body.role, id);
    const adminClient = createAdminClient();

    if (oldRole === "client" && body.role !== "client") {
      const { data: contact } = await adminClient
        .from("contacts")
        .select("id")
        .eq("user_id", id)
        .maybeSingle();

      if (contact) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id")
          .eq("contact_id", contact.id)
          .limit(1);

        if (!orders || orders.length === 0) {
          console.log("[USER PATCH] usuwam contact (brak zamowien) userId=%s", id);
          await adminClient.from("contacts").delete().eq("user_id", id);
        } else {
          console.log("[USER PATCH] zachowuje contact (ma zamówienia) userId=%s", id);
        }
      }
    }

    if (oldRole !== "client" && (body.role as string) === "client") {
      const { data: existingContact } = await adminClient
        .from("contacts")
        .select("id")
        .eq("user_id", id)
        .maybeSingle();

      if (!existingContact) {
        console.log("[USER PATCH] tworze contact dla nowego klienta userId=%s", id);
        const { data: userProfile } = await supabase
          .from("users")
          .select("full_name, phone")
          .eq("id", id)
          .single();
        const { data: authData } = await adminClient.auth.admin.getUserById(id);

        await adminClient.from("contacts").insert({
          user_id: id,
          full_name: userProfile?.full_name ?? "",
          email: authData?.user?.email ?? null,
          phone: userProfile?.phone ?? null,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
});
