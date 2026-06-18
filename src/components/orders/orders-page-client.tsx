"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { NewOrderForm } from "./new-order-form";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

export function OrdersPageClient({
  products,
  orderCount,
}: {
  products: ProductOption[];
  orderCount: number;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Zamowienia</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {orderCount} zamowien w systemie
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
          placeholder="Szukaj po numerze, kliencie..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      {/* Modal */}
      {showForm && (
        <NewOrderForm
          products={products}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
