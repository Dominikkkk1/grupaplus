"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Check, Loader2, AlertCircle } from "lucide-react";
import { CARRIERS } from "@/lib/carriers";

export interface CarrierSetting {
  carrier: string;
  pickup_time: string | null;
  notes: string | null;
}

/**
 * Godziny odbioru kurierow — edytowalne przez admina.
 *
 * Swiadomie NIE sa zaszyte w kodzie: zla godzina to przegapiony kurier,
 * a drukarnia musi je zmieniac sama, bez wdrozenia.
 *
 * JEDEN przycisk zapisuje CALA tabelke. Wczesniej kazdy wiersz mial wlasny
 * i latwo bylo wpisac godziny wszedzie, kliknac raz i stracic reszte.
 */
export function CarrierSettingsClient({ settings }: { settings: CarrierSetting[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const byCarrier = new Map(settings.map((s) => [s.carrier, s]));
  const [values, setValues] = useState<Record<string, { time: string; notes: string }>>(
    Object.fromEntries(
      CARRIERS.map((c) => [
        c.code,
        {
          // z bazy przychodzi "16:00:00", input type=time chce "16:00"
          time: (byCarrier.get(c.code)?.pickup_time ?? "").slice(0, 5),
          notes: byCarrier.get(c.code)?.notes ?? "",
        },
      ])
    )
  );

  function set(carrier: string, pole: "time" | "notes", wartosc: string) {
    setValues((v) => ({ ...v, [carrier]: { ...v[carrier], [pole]: wartosc } }));
    setSaved(false);
  }

  async function saveAll() {
    setError("");
    setSaving(true);

    const res = await fetch("/api/carrier-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: CARRIERS.map((c) => ({
          carrier: c.code,
          pickupTime: values[c.code].time || null,
          notes: values[c.code].notes || null,
        })),
      }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Nie udało się zapisać");
    } else {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  const ileZGodzina = CARRIERS.filter((c) => values[c.code].time).length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-base font-semibold text-zinc-900 sm:text-lg">
          Godziny odbioru kurierów
        </h1>
        <p className="mt-0.5 text-[12px] text-zinc-500 sm:text-[13px]">
          Pokazują się na stronie &quot;Do wysyłki&quot; przy każdej grupie przewoźnika,
          razem z informacją, ile czasu zostało do odbioru. Puste pole = bez godziny.
        </p>
      </div>

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5">Przewoźnik</th>
              <th className="px-4 py-2.5">Godzina odbioru</th>
              <th className="px-4 py-2.5">Uwagi</th>
            </tr>
          </thead>
          <tbody>
            {CARRIERS.map((c) => (
              <tr key={c.code} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-900">
                    <Truck size={14} className="text-zinc-400" />
                    {c.label}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="time"
                    value={values[c.code].time}
                    onChange={(e) => set(c.code, "time", e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    value={values[c.code].notes}
                    onChange={(e) => set(c.code, "notes", e.target.value)}
                    placeholder="np. kurier dzwoni 15 min wcześniej"
                    className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Jeden zapis na cala tabelke */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3">
          <span className="text-[12px] text-zinc-500">
            {ileZGodzina === 0
              ? "Żaden przewoźnik nie ma jeszcze ustawionej godziny"
              : `Ustawione godziny: ${ileZGodzina} z ${CARRIERS.length}`}
          </span>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                <Check size={14} />
                Zapisano
              </span>
            )}
            <button
              onClick={saveAll}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Zapisz godziny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
