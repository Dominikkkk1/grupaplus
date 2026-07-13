import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * PATCH /api/contacts/[id] — edycja kontaktu
 */
export const PATCH = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  if (body.fullName !== undefined) updateData.full_name = (body.fullName as string).trim();
  if (body.email !== undefined) updateData.email = body.email ? (body.email as string).trim() : null;
  if (body.phone !== undefined) updateData.phone = body.phone ? (body.phone as string).trim() : null;
  if (body.companyId !== undefined) updateData.company_id = body.companyId || null;
  if (body.isPrimary !== undefined) updateData.is_primary = body.isPrimary;
  if (body.isBlacklisted !== undefined) updateData.is_blacklisted = body.isBlacklisted;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
  }

  if (updateData.email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", updateData.email as string)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Kontakt z tym emailem już istnieje" }, { status: 409 });
    }
  }

  const { error } = await supabase.from("contacts").update(updateData).eq("id", id);

  if (error) {
    console.error("[CONTACTS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

/**
 * DELETE /api/contacts/[id] — usuwanie kontaktu
 */
export const DELETE = withAuth("admin", async (_request, { supabase }, params) => {
  const id = params!.id;

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
    console.error("[CONTACTS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
