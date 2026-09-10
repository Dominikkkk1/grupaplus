"use client";

import Link from "next/link";
import { Printer, Star, Package, Truck, Store } from "lucide-react";
import { CARRIER_GROUPS, CARRIER_LABELS } from "@/lib/carriers";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";

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
}: {
  title: string;
  icon: React.ReactNode;
  orders: ShippingOrder[];
  accent?: "zinc" | "amber" | "emerald";
  hint?: string;
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
        {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Nr</th>
              <th className="px-3 py-2">Klient</th>
              <th className="px-3 py-2">Telefon</th>
              <th className="px-3 py-2">Termin</th>
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

export function ShippingPageClient({ orders }: { orders: ShippingOrder[] }) {
  useRealtimeRefresh(["orders"], "shipping-realtime");

  const shipping = orders.filter((o) => o.delivery_type !== "pickup");
  const pickup = orders.filter((o) => o.delivery_type === "pickup");

  // Grupy: InPost / DPD / Pozostali kurierzy / bez wybranego przewoznika
  const groups = CARRIER_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    orders: shipping.filter((o) => o.carrier && (g.codes as string[]).includes(o.carrier)),
  }));

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
              hint={
                g.key === "pozostali"
                  ? g.orders
                      .map((o) => (o.carrier ? CARRIER_LABELS[o.carrier] : null))
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
