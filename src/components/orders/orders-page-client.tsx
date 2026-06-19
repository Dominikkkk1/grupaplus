"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Package } from "lucide-react";
import { NewOrderForm } from "./new-order-form";
import { STATUS_CONFIG, SOURCE_LABELS } from "@/lib/order-constants";

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
}: {
  products: ProductOption[];
  orders: Order[];
  contacts?: ContactOption[];
  companies?: CompanyOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = orders.filter((o) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.contact?.full_name?.toLowerCase().includes(q) ||
      o.company?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Zamowienia</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {orders.length} zamowien w systemie
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          <Plus size={16} />
          Nowe zamowienie
        </button>
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

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Nr zamowienia</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Zrodlo</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Klient</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Platnosc</th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const status = STATUS_CONFIG[order.status] ?? {
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
                    <td className="px-4 py-3 text-[13px] text-zinc-600">
                      {SOURCE_LABELS[order.source] ?? order.source}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-900">
                      {order.company?.name ?? order.contact?.full_name ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium ${status.color}`}
                      >
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
            Kliknij &quot;Nowe zamowienie&quot; aby dodac reczne zlecenie lub
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
