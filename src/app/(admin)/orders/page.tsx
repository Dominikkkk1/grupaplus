import { createClient } from "@/lib/supabase/server";

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

  if (error) {
    return <p className="text-red-600">Blad: {error.message}</p>;
  }

  const statusLabels: Record<string, string> = {
    new: "Nowe",
    confirmed: "Potwierdzone",
    in_production: "W produkcji",
    ready: "Gotowe",
    shipped: "Wyslane",
    delivered: "Dostarczone",
    cancelled: "Anulowane",
  };

  const sourceLabels: Record<string, string> = {
    allegro: "Allegro",
    woo: "Sklep",
    email: "Email",
    stacjonarne: "Stacjonarne",
    baselinker: "BaseLinker",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zamowienia</h1>
        <span className="text-sm text-zinc-500">
          {orders?.length ?? 0} zamowien
        </span>
      </div>

      {orders && orders.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Nr
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Zrodlo
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Klient
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Platnosc
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <a
                      href={`/orders/${order.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {order.order_number}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {sourceLabels[order.source] ?? order.source}
                  </td>
                  <td className="px-4 py-3">
                    {(order.company as { name: string } | null)?.name ??
                      (order.contact as { full_name: string } | null)
                        ?.full_name ??
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {order.payment_status === "paid"
                      ? "Oplacone"
                      : order.payment_status === "cod"
                        ? "Za pobraniem"
                        : "Oczekuje"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(order.created_at).toLocaleDateString("pl-PL")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-zinc-500">Brak zamowien</p>
          <p className="mt-1 text-sm text-zinc-400">
            Zamowienia pojawia sie automatycznie po podlaczeniu WooCommerce
          </p>
        </div>
      )}
    </div>
  );
}
