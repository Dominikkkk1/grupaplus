import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { isCarrierCode } from "@/lib/carriers";

/**
 * PATCH /api/carrier-settings — godzina odbioru dla przewoźnika (admin)
 * Body: { carrier, pickupTime: "16:00" | null, notes?: string | null }
 */
export const PATCH = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const { carrier } = body;

  if (!isCarrierCode(carrier)) {
    return NextResponse.json({ error: "Nieznany przewoźnik" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.pickupTime !== undefined) {
    const t = body.pickupTime;
    if (t === null || t === "") {
      updateData.pickup_time = null;
    } else if (typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
      updateData.pickup_time = t;
    } else {
      return NextResponse.json(
        { error: "Godzina musi być w formacie GG:MM" },
        { status: 400 }
      );
    }
  }

  if (body.notes !== undefined) {
    updateData.notes = typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 200)
      : null;
  }

  const { error } = await supabase
    .from("carrier_settings")
    .update(updateData)
    .eq("carrier", carrier);

  if (error) {
    console.error("[CARRIER SETTINGS] error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
