import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anonymizeContact } from "@/lib/rodo/anonymize";

/**
 * POST /api/contacts/[id]/anonymize — RODO anonimizacja danych osobowych
 * Admin only. Usuwa dane osobowe kontaktu, odlacza zamowienia, usuwa pliki.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAuth
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sprawdz czy kontakt istnieje i nie jest juz zanonimizowany
  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, anonymized_at")
    .eq("id", id)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: "Kontakt nie znaleziony" }, { status: 404 });
  }

  if (contact.anonymized_at) {
    return NextResponse.json({ error: "Kontakt już zanonimizowany" }, { status: 409 });
  }

  const result = await anonymizeContact(supabase, id);

  return NextResponse.json({
    ok: true,
    contactId: id,
    ...result,
  });
}
