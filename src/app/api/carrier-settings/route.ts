import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { isCarrierCode } from "@/lib/carriers";

const GODZINA = /^([01]\d|2[0-3]):[0-5]\d$/;

type Wiersz = { carrier: string; pickup_time: string | null; notes: string | null; updated_at: string };

/**
 * PATCH /api/carrier-settings — godziny odbioru kurierów (admin)
 *
 * Przyjmuje CAŁĄ tabelkę naraz:
 *   { items: [{ carrier, pickupTime: "16:00" | null, notes?: string | null }, ...] }
 *
 * Dla zgodności obsługuje też pojedynczy wiersz: { carrier, pickupTime, notes }.
 *
 * Walidujemy WSZYSTKO przed zapisem — żeby jedna literówka nie zapisała
 * połowy tabelki i zostawiła resztę po staremu.
 */
export const PATCH = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const surowe = Array.isArray(body.items) ? body.items : [body];
  const teraz = new Date().toISOString();
  const wiersze: Wiersz[] = [];

  for (const pozycja of surowe) {
    const item = pozycja as Record<string, unknown>;

    if (!isCarrierCode(item.carrier)) {
      return NextResponse.json({ error: "Nieznany przewoźnik" }, { status: 400 });
    }

    let pickup: string | null = null;
    const t = item.pickupTime;
    if (t !== null && t !== undefined && t !== "") {
      if (typeof t !== "string" || !GODZINA.test(t)) {
        return NextResponse.json(
          { error: `Godzina dla przewoźnika ${item.carrier} musi być w formacie GG:MM` },
          { status: 400 }
        );
      }
      pickup = t;
    }

    wiersze.push({
      carrier: item.carrier,
      pickup_time: pickup,
      notes:
        typeof item.notes === "string" && item.notes.trim()
          ? item.notes.trim().slice(0, 200)
          : null,
      updated_at: teraz,
    });
  }

  if (wiersze.length === 0) {
    return NextResponse.json({ error: "Brak danych do zapisania" }, { status: 400 });
  }

  const { error } = await supabase
    .from("carrier_settings")
    .upsert(wiersze, { onConflict: "carrier" });

  if (error) {
    console.error("[CARRIER SETTINGS] error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  const zGodzina = wiersze.filter((w) => w.pickup_time).length;
  console.log("[CARRIER SETTINGS] zapisano %d wierszy (%d z godzina)", wiersze.length, zGodzina);

  return NextResponse.json({ ok: true, saved: wiersze.length, withTime: zGodzina });
});
