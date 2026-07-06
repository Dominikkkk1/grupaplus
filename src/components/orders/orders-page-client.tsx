"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Package, Star, MessageSquare, Store } from "lucide-react";
import { NewOrderForm } from "./new-order-form";
import { STATUS_CONFIG, SOURCE_LABELS, getClientStatus } from "@/lib/order-constants";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  lead_time_days: number | null;
  base_price: number | null;
}

export interface Order {
  id: string;
  order_number: string;
  source: string;
  status: string;
  payment_status: string;
  deadline: string | null;
  is_priority: boolean;
  delivery_type: string;
  notes: string | null;
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
  is_blacklisted: boolean;
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
  const searchParams = useSearchParams();
  const VALID_FILTERS = ["active", "all", "priority", "at_risk", "new_today", "new", "confirmed", "awaiting_approval", "in_production", "ready", "finished"];
  const rawFilter = searchParams.get("filter") || "active";
  const initialFilter = VALID_FILTERS.includes(rawFilter) ? rawFilter : "active";
  // Auto-open form z kalkulatora lub duplikacji
  const newOrderParam = searchParams.get("newOrder");
  const isDuplicate = searchParams.get("duplicate") === "1";
  const calcDesc = searchParams.get("desc");
  const calcQty = searchParams.get("qty");
  const calcPrice = searchParams.get("unitPrice");
  const initialItem = (newOrderParam && !isDuplicate) ? {
    description: calcDesc || "",
    quantity: parseInt(calcQty || "1") || 1,
    unitPrice: parseFloat(calcPrice || "0") || 0,
  } : undefined;

  // Duplikacja: odczytaj pełne dane z sessionStorage
  const duplicateData = (() => {
    if (!isDuplicate || typeof window === "undefined") return undefined;
    try {
      const raw = sessionStorage.getItem("duplicateOrder");
      if (raw) {
        sessionStorage.removeItem("duplicateOrder");
        return JSON.parse(raw) as {
          items: { productId: string; description: string; quantity: number; unitPrice: string }[];
          customerName: string;
          customerEmail: string;
          customerPhone: string;
        };
      }
    } catch { /* ignore */ }
    return undefined;
  })();
  const [showForm, setShowForm] = useState(!!newOrderParam);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState<"date" | "status" | "number">("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Statusy aktywne vs zakończone
  const ACTIVE_STATUSES = ["new", "confirmed", "awaiting_approval", "in_production", "ready"];
  const FINISHED_STATUSES = ["shipped", "delivered", "cancelled"];

  // Daty do filtrow
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const atRiskCount = orders.filter((o) => {
    if (!o.deadline) return false;
    if (FINISHED_STATUSES.includes(o.status)) return false;
    return new Date(o.deadline) < in24h;
  }).length;
  const priorityCount = orders.filter((o) => o.is_priority).length;

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
      if (statusFilter === "priority" && !o.is_priority) return false;
      if (statusFilter === "new_today") {
        if (o.status !== "new") return false;
        if (new Date(o.created_at) < todayStart) return false;
      }
      if (statusFilter === "at_risk") {
        if (!o.deadline || FINISHED_STATUSES.includes(o.status)) return false;
        if (new Date(o.deadline) >= in24h) return false;
      }
      if (!["all", "active", "finished", "priority", "at_risk", "new_today"].includes(statusFilter) && o.status !== statusFilter) return false;
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
      // Priorytetowe zawsze na gorze
      if (a.is_priority !== b.is_priority) return a.is_priority ? -1 : 1;
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
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div>
          <h1 className="text-base font-semibold text-zinc-900 sm:text-lg">
            {isClient ? "Moje zamówienia" : "Zamówienia"}
          </h1>
          <p className="mt-0.5 text-[12px] text-zinc-500 sm:text-[13px]">
            {orders.length} zamówień {isClient ? "" : "w systemie"}
          </p>
        </div>
        {userRole === "admin" && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[13px]"
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
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {[
            { key: "active", label: "Aktywne", count: activeCount },
            { key: "all", label: "Wszystkie", count: orders.length },
            { key: "priority", label: "Priorytetowe", count: priorityCount },
            { key: "at_risk", label: "Zagrożony termin", count: atRiskCount },
            { key: "new", label: "Nowe", count: statusCounts["new"] ?? 0 },
            { key: "confirmed", label: "Potwierdzone", count: statusCounts["confirmed"] ?? 0 },
            { key: "awaiting_approval", label: "Oczekuje na akceptację", count: statusCounts["awaiting_approval"] ?? 0 },
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
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th onClick={() => toggleSort("number")} className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">Nr {sortBy === "number" ? (sortAsc ? "↑" : "↓") : ""}</th>
                {!isClient && <th className="hidden px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 sm:table-cell">Źródło</th>}
                {!isClient && <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Klient</th>}
                <th onClick={() => toggleSort("status")} className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900">Status {sortBy === "status" ? (sortAsc ? "↑" : "↓") : ""}</th>
                {!isClient && <th className="hidden px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 lg:table-cell">Płatność</th>}
                {!isClient && <th className="hidden px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 lg:table-cell">Termin</th>}
                <th onClick={() => toggleSort("date")} className="hidden cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 sm:table-cell">Data {sortBy === "date" ? (sortAsc ? "↑" : "↓") : ""}</th>
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
                      <div className="flex items-center gap-1.5">
                        {order.is_priority && (
                          <Star size={13} className="flex-shrink-0 fill-amber-400 text-amber-400" />
                        )}
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-mono text-[13px] font-medium text-zinc-900 hover:text-blue-600"
                        >
                          {order.order_number}
                        </Link>
                        {order.notes && (
                          <MessageSquare size={12} className="flex-shrink-0 text-amber-500" />
                        )}
                      </div>
                    </td>
                    {!isClient && (
                      <td className="hidden px-4 py-3 text-[13px] text-zinc-600 sm:table-cell">
                        {SOURCE_LABELS[order.source] ?? order.source}
                      </td>
                    )}
                    {!isClient && (
                      <td className="px-4 py-3 text-[13px] text-zinc-900">
                        <span className="flex items-center gap-1.5">
                          {order.company?.name ?? order.contact?.full_name ?? "\u2014"}
                          {order.delivery_type === "pickup" && (
                            <Store size={12} className="flex-shrink-0 text-emerald-500" />
                          )}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[12px] font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    {!isClient && (
                      <td className="hidden px-4 py-3 text-[13px] text-zinc-600 lg:table-cell">
                        {order.payment_status === "paid"
                          ? "Opłacone"
                          : order.payment_status === "cod"
                            ? "Za pobraniem"
                            : "Oczekuje"}
                      </td>
                    )}
                    {!isClient && (
                      <td className="hidden px-4 py-3 text-[13px] lg:table-cell">
                        {order.deadline ? (() => {
                          const dl = new Date(order.deadline);
                          const isOverdue = dl < now;
                          const isUrgent = !isOverdue && dl < in24h;
                          return (
                            <span className={`font-medium ${isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-zinc-600"}`}>
                              {dl.toLocaleDateString("pl-PL")}
                            </span>
                          );
                        })() : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="hidden px-4 py-3 text-[13px] text-zinc-500 sm:table-cell">
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
          <p className="text-sm font-medium text-zinc-900">Brak zamówień</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Kliknij &quot;Nowe zamówienie&quot; aby dodać ręczne zlecenie lub
            podłącz WooCommerce.
          </p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <NewOrderForm
          products={products}
          contacts={contacts}
          companies={companies}
          initialItem={initialItem}
          duplicateData={duplicateData}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
