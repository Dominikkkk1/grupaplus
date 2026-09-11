"use client";

import Link from "next/link";
import { Printer, Star, Package, Truck, Store, Clock } from "lucide-react";
import { CARRIER_GROUPS, CARRIER_LABELS } from "@/lib/carriers";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";
import { useSyncExternalStore } from "react";

export interface PickupInfo {
  time: string | null;
  notes: string | null;
}

/** Ile minut do godziny odbioru. Ujemne = kurier juz byl. */
function minutesUntil(hhmm: string, now: Date): number {
  const [h, m] = hhmm.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function formatLeft(mins: number): string {
  if (mins < 0) return "kurier już był";
  if (mins < 60) return `za ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `za ${h} h` : `za ${h} h ${m} min`;
}

/**
 * Aktualna minuta, odczytywana przez useSyncExternalStore.
 *
 * Czas to "zewnetrzne zrodlo danych" spoza Reacta i wlasnie do tego sluzy ten
 * hook. Na serwerze zwracamy null (stad brak licznika w pierwszym renderze),
 * wiec nie ma rozjazdu miedzy HTML-em z serwera a przegladarka. Snapshot to
 * numer minuty, a nie `new Date()` — inaczej kazdy render dawalby inna wartosc
 * i React wpadlby w petle.
 */
function subscribeMinute(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => null;

function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeMinute, currentMinute, serverMinute);
  return minute === null ? null : new Date(minute * 60_000);
}

/** Pasek z godzina odbioru i licznikiem, ile zostalo czasu. */
function PickupBadge({ time }: { time: string }) {
  const now = useNow();
  const mins = now ? minutesUntil(time, now) : null;
  const pilne = mins !== null && mins >= 0 && mins <= 90;
  const pozamiatane = mins !== null && mins < 0;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        pozamiatane
          ? "border-zinc-200 bg-zinc-50 text-zinc-500"
          : pilne
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <Clock size={11} />
      odbiór {time}
      {mins !== null && <span className="opacity-80">· {formatLeft(mins)}</span>}
    </span>
  );
}

export interface ShippingOrder {
  id: string;
  order_number: string;
  status: string;
  carrier: string | null;
  shipping_method: string | null;
  delivery_type: string;
  deadline: string | null;
  is_priority: boolean;
  tracking_number: string | null;
  contact: { full_name: string; phone: string | null } | null;
  company: { name: string } | null;
}

function OrderRow({ o }: { o: ShippingOrder }) {
  const client = o.company?.name ?? o.contact?.full_name ?? "—";
  const overdue = o.deadline ? new Date(o.deadline) < new Date() : false;
  return (
    <tr className="border-b border-zinc-100 last:border-0">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {o.is_priority && <Star size={12} className="fill-amber-400 text-amber-400" />}
          <Link
            href={`/orders/${o.id}`}
            className="font-mono text-[13px] font-medium text-zinc-900 hover:text-blue-600"
          >
            {o.order_number}
          </Link>
        </div>
      </td>
      <td className="px-3 py-2 text-[13px] text-zinc-700">{client}</td>
      <td className="px-3 py-2 text-[13px] text-zinc-500">
        {o.contact?.phone ?? "—"}
      </td>
      <td className="px-3 py-2 text-[13px]">
        {o.deadline ? (
          <span className={overdue ? "font-medium text-red-600" : "text-zinc-600"}>
            {new Date(o.deadline).toLocaleDateString("pl-PL")}
          </span>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-[12px] text-zinc-500">
        {o.tracking_number ? (
          <span className="font-mono">{o.tracking_number}</span>
        ) : (
          <span className="text-zinc-300">brak listu</span>
        )}
      </td>
    </tr>
  );
}

function Section({
  title,
  icon,
  orders: list,
  accent = "zinc",
  hint,
  pickupTime,
}: {
  title: string;
  icon: React.ReactNode;
  orders: ShippingOrder[];
  accent?: "zinc" | "amber" | "emerald";
  hint?: string;
  pickupTime?: string | null;
}) {
  if (list.length === 0) return null;
  const accents = {
    zinc: "border-zinc-200 bg-white",
    amber: "border-amber-200 bg-amber-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
  };
  return (
    <div className={`mb-5 overflow-hidden rounded-lg border shadow-sm ${accents[accent]}`}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
          {icon}
          {title}
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
            {list.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
          {pickupTime && <PickupBadge time={pickupTime} />}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Nr</th>
              <th className="px-3 py-2">Klient</th>
              <th className="px-3 py-2">Telefon</th>
              <th className="px-3 py-2">Termin realizacji</th>
              <th className="px-3 py-2">List przewozowy</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ShippingPageClient({
  orders,
  pickupTimes = {},
}: {
  orders: ShippingOrder[];
  /** kod przewoznika -> godzina odbioru i uwagi (ustawiane w /settings/carriers) */
  pickupTimes?: Record<string, PickupInfo>;
}) {
  useRealtimeRefresh(["orders"], "shipping-realtime");

  /**
   * Godzina dla calej grupy = NAJWCZESNIEJSZY odbior sposrod przewoznikow,
   * ktorzy faktycznie maja w niej paczki. To ten termin zamyka sie pierwszy.
   */
  function groupPickup(codes: string[], list: ShippingOrder[]): string | null {
    const obecne = new Set(list.map((o) => o.carrier).filter(Boolean) as string[]);
    const godziny = codes
      .filter((c) => obecne.has(c))
      .map((c) => pickupTimes[c]?.time)
      .filter((t): t is string => !!t)
      .sort();
    return godziny[0] ?? null;
  }

  const shipping = orders.filter((o) => o.delivery_type !== "pickup");
  const pickup = orders.filter((o) => o.delivery_type === "pickup");

  // Grupy: InPost / DPD / Pozostali kurierzy / bez wybranego przewoznika
  const groups = CARRIER_GROUPS.map((g) => {
    const list = shipping.filter((o) => o.carrier && (g.codes as string[]).includes(o.carrier));
    return {
      key: g.key,
      label: g.label,
      orders: list,
      pickupTime: groupPickup(g.codes as string[], list),
    };
  })
    // Najblizszy odbior na gorze — to nim trzeba zajac sie najpierw.
    // Grupy bez ustawionej godziny lecą na koniec.
    .sort((a, b) => {
      if (a.pickupTime && b.pickupTime) return a.pickupTime.localeCompare(b.pickupTime);
      if (a.pickupTime) return -1;
      if (b.pickupTime) return 1;
      return 0;
    });

  const bezPrzewoznika = shipping.filter((o) => !o.carrier);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900 sm:text-lg">Do wysyłki</h1>
          <p className="mt-0.5 text-[12px] text-zinc-500 sm:text-[13px]">
            Zamówienia ze statusem &quot;Gotowe&quot;, pogrupowane wg przewoźnika.
            Razem {orders.length}.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-600 hover:border-zinc-300 print:hidden"
        >
          <Printer size={14} />
          Drukuj listę
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Package size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">Nic nie czeka na wydanie</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Tu trafiają zamówienia po zmianie statusu na &quot;Gotowe&quot;.
          </p>
        </div>
      ) : (
        <>
          {bezPrzewoznika.length > 0 && (
            <Section
              title="Bez wybranego przewoźnika"
              icon={<Truck size={15} className="text-amber-600" />}
              orders={bezPrzewoznika}
              accent="amber"
              hint="Uzupełnij przewoźnika na karcie zamówienia, inaczej paczka wypadnie z listy"
            />
          )}

          {groups.map((g) => (
            <Section
              key={g.key}
              title={g.label}
              icon={<Truck size={15} className="text-zinc-500" />}
              orders={g.orders}
              pickupTime={g.pickupTime}
              hint={
                g.key === "pozostali"
                  ? g.orders
                      .map((o) => {
                        if (!o.carrier) return null;
                        const godz = pickupTimes[o.carrier]?.time;
                        return CARRIER_LABELS[o.carrier] + (godz ? ` ${godz}` : "");
                      })
                      .filter((v, i, a) => v && a.indexOf(v) === i)
                      .join(", ")
                  : undefined
              }
            />
          ))}

          <Section
            title="Odbiór osobisty"
            icon={<Store size={15} className="text-emerald-600" />}
            orders={pickup}
            accent="emerald"
            hint="Klient odbiera sam — nie pakować do kuriera"
          />
        </>
      )}
    </div>
  );
}
