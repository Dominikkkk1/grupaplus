import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * POST /api/companies — tworzenie nowej firmy
 */
export const POST = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { name, nip, address, notes } = parsed.data as Record<string, unknown>;

  if (!name || !(name as string).trim()) {
    return NextResponse.json(
      { error: "Nazwa firmy jest wymagana" },
      { status: 400 }
    );
  }

  if (nip) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("nip", nip as string)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Firma z tym NIP-em juz istnieje" },
        { status: 409 }
      );
    }
  }

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name: (name as string).trim(),
      nip: nip ? (nip as string).trim() : null,
      address: address ? (address as string).trim() : null,
      notes: notes ? (notes as string).trim() : null,
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("[COMPANIES] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(company);
});
