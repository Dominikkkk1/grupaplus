"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Package } from "lucide-react";
import { NewOrderForm } from "./new-order-form";
import { STATUS_CONFIG, SOURCE_LABELS, getClientStatus } from "@/lib/order-constants";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  source: string;
  status: string;
  payment_status: string;
  created_at: string;
  contact: { full_name: string } | null;
  company: { name: string } | null;
}

interface ContactOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
  nip: string | null;
}

export function OrdersPageClient({
  products,
  orders,
  contacts = [],
  companies = [],
  userRole = "admin",
}: {
  products: ProductOption[];
  orders: Order[];
  contacts?: ContactOption[];
  companies?: CompanyOption[];
  userRole?: string;
}) {
  const isClient = userRole === "client";
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortBy, setSortBy] = useState<"date" | "status" | "number">("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Statusy aktywne vs zakończone
  const ACTIVE_STATUSES = ["new", "confirmed", "in_production", "ready"];
  const FINISHED_STATUSES = ["shipped", "delivered", "cancelled"];

  // Liczniki per status
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const finishedCount = orders.filter((o) => FINISHED_STATUSES.includes(o.status)).length;

  const filtered = orders
    .filter((o) => {
      // Filtr statusu
      if (statusFilter === "active" && !ACTIVE_STATUSES.includes(o.status)) return false;
      if (statusFilter === "finished" && !FINISHED_STATUSES.includes(o.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && statusFilter !== "finished" && o.status !== statusFilter) return false;
      // Wyszukiwarka
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.contact?.full_name?.toLowerCase().includes(q) ||
        o.company?.name?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
      else if (sortBy === "number") cmp = a.order_number.localeCompare(b.order_number);
      return sortAsc ? cmp : -cmp;
    });

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(false); }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            {isClient ? "Moje zamówienia" : "Zamówienia"}
          </h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {orders.length} zamówień {isClient ? "" : "w systemie"}
          </p>
        </div>
        {!isClient && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
          >
            <Plus size={16} />
            Nowe zamówienie
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po numerze, kliencie..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      {/* Filtry statusu */}
      {!isClient && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[
            { key: "active", label: "Aktywne", count: activeCount },
            { key: "all", label: "Wszystkie", count: orders.length },
            { key: "new", label: "Nowe", count: statusCounts["new"] ?? 0 },
            { key: "confirmed", label: "Potwierdzone", count: statusCounts["confirmed"] ?? 0 },
            { key: "in_production", label: "W produkcji", count: statusCounts["in_production"] ?? 0 },
            { key: "ready", label: "Gotowe", count: statusCounts["ready"] ?? 0 },
            { key: "finished", label: "Zakończone", count: finishedCount },
          ]
            .filter((f) => f.count > 0 || f.key === "active" || f.key === "all")
            .map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  statusFilter === f.key
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`ml-1.5 ${statusFilter === f.key ? "text-zinc-400" : "text-zinc-400"}`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th onClick={() => toggleSort("number")} className="cursor-pointer px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">Nr zamówienia {sortBy === "number" ? (sortAsc ? "↑" : "↓") : ""}</th>
                {!isClient && <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Źródło</th>}
                {!isClient && <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Klient</th>}
                <th onClick={() => toggleSort("status")} className="cursor-pointer px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">Status {sortBy === "status" ? (sortAsc ? "↑" : "↓") : ""}</th>
                {!isClient && <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Płatność</th>}
                <th onClick={() => toggleSort("date")} className="cursor-pointer px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">Data {sortBy === "date" ? (sortAsc ? "↑" : "↓") : ""}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const status = isClient
                  ? getClientStatus(order.status)
                  : STATUS_CONFIG[order.status] ?? {
                      label: order.status,
                      color: "bg-zinc-50 text-zinc-600 border-zinc-200",
                    };
                return (
                  <tr
                    key={order.id}
                    className="border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-[13px] font-medium text-zinc-900 hover:text-blue-600"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    {!isClient && (
                      <td className="px-4 py-3 text-[13px] text-zinc-600">
                        {SOURCE_LABELS[order.source] ?? order.source}
                      </td>
                    )}
                    {!isClient && (
                      <td className="px-4 py-3 text-[13px] text-zinc-900">
                        {order.company?.name ?? order.contact?.full_name ?? "\u2014"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    {!isClient && (
                      <td className="px-4 py-3 text-[13px] text-zinc-600">
                        {order.payment_status === "paid"
                          ? "Opłacone"
                          : order.payment_status === "cod"
                            ? "Za pobraniem"
                            : "Oczekuje"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-[13px] text-zinc-500">
                      {new Date(order.created_at).toLocaleDateString("pl-PL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : query ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-zinc-500">
            Brak wynikow dla &quot;{query}&quot;
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Package size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">Brak zamowien</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Kliknij &quot;Nowe zamówienie&quot; aby dodac reczne zlecenie lub
            podlacz WooCommerce.
          </p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <NewOrderForm
          products={products}
          contacts={contacts}
          companies={companies}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
