import { createClient } from "@/lib/supabase/server";
import { Package, Plus, Search } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "Nowe", color: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Potwierdzone", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  in_production: { label: "W produkcji", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ready: { label: "Gotowe", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  shipped: { label: "Wyslane", color: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered: { label: "Dostarczone", color: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  cancelled: { label: "Anulowane", color: "bg-red-50 text-red-700 border-red-200" },
};

const SOURCE_LABELS: Record<string, string> = {
  allegro: "Allegro",
  woo: "Sklep WWW",
  email: "Email",
  stacjonarne: "Stacjonarne",
  baselinker: "BaseLinker",
};

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      *,
      contact:contacts(full_name),
      company:companies(name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Zamowienia</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {orders?.length ?? 0} zamowien w systemie
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
          <Plus size={16} />
          Nowe zamowienie
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Szukaj po numerze, kliencie..."
            className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Blad: {error.message}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Nr zamowienia
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Zrodlo
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Klient
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Platnosc
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-zinc-50 text-zinc-600 border-zinc-200" };
                return (
                  <tr key={order.id} className="border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      <a
                        href={`/orders/${order.id}`}
                        className="font-mono text-[13px] font-medium text-zinc-900 hover:text-blue-600"
                      >
                        {order.order_number}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-600">
                      {SOURCE_LABELS[order.source] ?? order.source}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-900">
                      {(order.company as { name: string } | null)?.name ??
                        (order.contact as { full_name: string } | null)?.full_name ??
                        "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-600">
                      {order.payment_status === "paid"
                        ? "Oplacone"
                        : order.payment_status === "cod"
                          ? "Za pobraniem"
                          : "Oczekuje"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-500">
                      {new Date(order.created_at).toLocaleDateString("pl-PL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Package size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">Brak zamowien</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Zamowienia pojawia sie po podlaczeniu WooCommerce lub dodaniu recznym.
          </p>
        </div>
      )}
    </div>
  );
}
