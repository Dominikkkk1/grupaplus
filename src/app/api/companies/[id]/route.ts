import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * PATCH /api/companies/[id] — edycja firmy
 */
export const PATCH = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = (body.name as string).trim();
  if (body.nip !== undefined) updateData.nip = body.nip ? (body.nip as string).trim() : null;
  if (body.address !== undefined) updateData.address = body.address ? (body.address as string).trim() : null;
  if (body.notes !== undefined) updateData.notes = body.notes ? (body.notes as string).trim() : null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
  }

  if (updateData.nip) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("nip", updateData.nip as string)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Firma z tym NIP-em juz istnieje" }, { status: 409 });
    }
  }

  const { error } = await supabase.from("companies").update(updateData).eq("id", id);

  if (error) {
    console.error("[COMPANIES] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

/**
 * DELETE /api/companies/[id] — usuwanie firmy
 */
export const DELETE = withAuth("admin", async (_request, { supabase }, params) => {
  const id = params!.id;

  const { error } = await supabase.from("companies").delete().eq("id", id);

  if (error) {
    console.error("[COMPANIES] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
