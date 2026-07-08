import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/contacts — tworzenie nowego kontaktu
 * Body: { fullName, email?, phone?, companyId?, isPrimary? }
 */
export async function POST(request: NextRequest) {
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
  const { fullName, email, phone, companyId, isPrimary, isBlacklisted } = body;

  if (!fullName || !fullName.trim()) {
    return NextResponse.json(
      { error: "Imie i nazwisko jest wymagane" },
      { status: 400 }
    );
  }

  // Sprawdz duplikat email (jesli podany)
  if (email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email.trim())
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
      full_name: fullName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      company_id: companyId || null,
      is_primary: isPrimary ?? false,
      is_blacklisted: isBlacklisted ?? false,
    })
    .select("id, full_name")
    .single();

  if (error) {
    console.error("[API] DB error:", error.message); return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(contact);
}
