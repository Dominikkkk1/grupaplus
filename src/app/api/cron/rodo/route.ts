import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anonymizeContact } from "@/lib/rodo/anonymize";

/**
 * GET /api/cron/rodo — automatyczna anonimizacja danych osobowych
 *
 * Wywoływany przez Vercel Cron (1-szy dzien miesiaca o 4:00).
 * - Osoby fizyczne (bez firmy): anonimizacja po 24 miesiącach
 * - Firmy: anonimizacja po 72 miesiącach (6 lat — kontrola skarbowa)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // 24 miesiace temu (osoby fizyczne)
  const personalCutoff = new Date(now);
  personalCutoff.setMonth(personalCutoff.getMonth() - 24);

  // 72 miesiace temu (firmy — 6 lat)
  const companyCutoff = new Date(now);
  companyCutoff.setMonth(companyCutoff.getMonth() - 72);

  // Osoby fizyczne: bez company_id, starsze niz 24 mies, nie zanonimizowane
  const { data: personalContacts } = await supabase
    .from("contacts")
    .select("id")
    .is("company_id", null)
    .is("anonymized_at", null)
    .lt("created_at", personalCutoff.toISOString())
    .limit(100);

  // Kontakty firmowe: z company_id, starsze niz 72 mies, nie zanonimizowane
  const { data: companyContacts } = await supabase
    .from("contacts")
    .select("id")
    .not("company_id", "is", null)
    .is("anonymized_at", null)
    .lt("created_at", companyCutoff.toISOString())
    .limit(100);

  const toAnonymize = [
    ...(personalContacts ?? []),
    ...(companyContacts ?? []),
  ];

  console.log(
    "[CRON RODO] personal=%d (>24m), company=%d (>72m)",
    personalContacts?.length ?? 0,
    companyContacts?.length ?? 0
  );

  let anonymized = 0;
  let errors = 0;

  for (const contact of toAnonymize) {
    try {
      await anonymizeContact(supabase, contact.id);
      anonymized++;
    } catch (err) {
      console.error("[CRON RODO] error anonymizing %s:", contact.id, err);
      errors++;
    }
  }

  console.log("[CRON RODO] done: anonymized=%d, errors=%d", anonymized, errors);

  return NextResponse.json({
    ok: true,
    found: toAnonymize.length,
    anonymized,
    errors,
  });
}
