import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * POST /api/contacts — tworzenie nowego kontaktu
 */
export const POST = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { fullName, email, phone, companyId, isPrimary, isBlacklisted } = parsed.data as Record<string, unknown>;

  if (!fullName || !(fullName as string).trim()) {
    return NextResponse.json(
      { error: "Imie i nazwisko jest wymagane" },
      { status: 400 }
    );
  }

  if (email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", (email as string).trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Kontakt z tym emailem już istnieje" },
        { status: 409 }
      );
    }
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      full_name: (fullName as string).trim(),
      email: email ? (email as string).trim() : null,
      phone: phone ? (phone as string).trim() : null,
      company_id: (companyId as string) || null,
      is_primary: (isPrimary as boolean) ?? false,
      is_blacklisted: (isBlacklisted as boolean) ?? false,
    })
    .select("id, full_name")
    .single();

  if (error) {
    console.error("[CONTACTS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(contact);
});
