import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/contacts/[id] — edycja kontaktu
 * Body: { fullName?, email?, phone?, companyId?, isPrimary? }
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

  if (body.fullName !== undefined) updateData.full_name = body.fullName.trim();
  if (body.email !== undefined)
    updateData.email = body.email?.trim() || null;
  if (body.phone !== undefined)
    updateData.phone = body.phone?.trim() || null;
  if (body.companyId !== undefined)
    updateData.company_id = body.companyId || null;
  if (body.isPrimary !== undefined) updateData.is_primary = body.isPrimary;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Brak danych do aktualizacji" },
      { status: 400 }
    );
  }

  // Sprawdz duplikat email (jesli zmieniany)
  if (updateData.email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", updateData.email as string)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Kontakt z tym emailem już istnieje" },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("contacts")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/contacts/[id] — usuwanie kontaktu
 * Nie mozna usunac jesli ma powiazane zamówienia
 */
export async function DELETE(
  _request: NextRequest,
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

  // Sprawdz czy kontakt ma zamówienia
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("contact_id", id)
    .limit(1);

  if (orders && orders.length > 0) {
    return NextResponse.json(
      { error: "Nie mozna usunac — kontakt ma powiazane zamówienia" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
