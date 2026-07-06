import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/cleanup — tygodniowe sprzatanie danych
 *
 * Wywoływany przez Vercel Cron (niedziela 3:00).
 * - Usuwa przetworzone webhook_events starsze niz 90 dni
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Usuń przetworzone webhook_events starsze niz 90 dni
  const { count, error } = await supabase
    .from("webhook_events")
    .delete({ count: "exact" })
    .eq("processed", true)
    .lt("created_at", ninetyDaysAgo);

  if (error) {
    console.error("[CRON CLEANUP] error:", error.message);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  console.log("[CRON CLEANUP] usunięto %d starych webhook_events", count ?? 0);

  return NextResponse.json({
    ok: true,
    deletedWebhookEvents: count ?? 0,
  });
}
