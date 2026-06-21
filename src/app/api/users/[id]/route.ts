import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/users/[id] — edycja użytkownika (admin only)
 * Body: { fullName?, role?, phone?, isActive? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  console.log("[USER PATCH] userId=%s body=%j", id, body);

  if (body.fullName !== undefined) updateData.full_name = body.fullName;
  if (body.role !== undefined) {
    if (!["admin", "operator", "client"].includes(body.role)) {
      return NextResponse.json({ error: "Nieprawidłowa rola" }, { status: 400 });
    }
    updateData.role = body.role;
  }
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.isActive !== undefined) updateData.is_active = body.isActive;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Brak danych do aktualizacji" },
      { status: 400 }
    );
  }

  // Pobierz stara role PRZED updatem (potrzebne do synchronizacji contacts)
  let oldRole: string | null = null;
  if (body.role !== undefined) {
    const { data: oldProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", id)
      .single();
    oldRole = oldProfile?.role ?? null;
  }

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Synchronizacja contacts przy zmianie roli
  if (body.role !== undefined && oldRole && oldRole !== body.role) {
    console.log("[USER PATCH] zmiana roli: %s → %s (userId=%s)", oldRole, body.role, id);
    const adminClient = createAdminClient();

    if (oldRole === "client" && body.role !== "client") {
      // Usun contact TYLKO jesli nie ma przypisanych zamowien
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

    if (oldRole !== "client" && body.role === "client") {
      // Stworz contact jesli brak
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
}
