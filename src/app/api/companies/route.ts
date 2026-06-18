import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/companies — tworzenie nowej firmy
 * Body: { name, nip?, address?, notes? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tylko admin moze dodawac firmy (recepcja)
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, nip, address, notes } = body;

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Nazwa firmy jest wymagana" },
      { status: 400 }
    );
  }

  // Sprawdz duplikat NIP (jesli podany)
  if (nip) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("nip", nip)
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
      name: name.trim(),
      nip: nip?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(company);
}
