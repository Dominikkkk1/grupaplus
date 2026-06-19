"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, ClipboardList, ArrowRight } from "lucide-react";
import { ProductForm } from "./product-form";

interface WorkflowStep {
  step_order: number;
  step: { name: string; color: string };
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  base_price: number | null;
  description: string | null;
  product_workflow: WorkflowStep[];
}

export function ProductsPageClient({
  products,
}: {
  products: Product[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const malyCount = products.filter((p) => p.category === "maly_format").length;
  const duzyCount = products.filter((p) => p.category === "duzy_format").length;

  const filtered = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Produkty</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {products.length} produktow w katalogu
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          <Plus size={16} />
          Dodaj produkt
        </button>
      </div>

      {/* Filtry kategorii */}
      <div className="mb-4 flex gap-2">
        {[
          { label: `Wszystkie (${products.length})`, value: null },
          { label: `Maly format (${malyCount})`, value: "maly_format" },
          { label: `Duzy format (${duzyCount})`, value: "duzy_format" },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setCategoryFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
              categoryFilter === f.value
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po nazwie, SKU..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((product) => {
            const steps = [...product.product_workflow].sort(
              (a, b) => a.step_order - b.step_order
            );
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-zinc-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-zinc-900">
                      {product.name}
                    </h3>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                        product.category === "duzy_format"
                          ? "bg-cyan-50 text-cyan-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {product.category === "duzy_format"
                        ? "Duzy format"
                        : "Maly format"}
                    </span>
                  </div>
                  {product.sku && (
                    <p className="mt-0.5 font-mono text-[12px] text-zinc-400">
                      SKU: {product.sku}
                    </p>
                  )}
                  {steps.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {steps.map((pw, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: pw.step.color }}
                          />
                          <span className="text-[11px] text-zinc-500">
                            {pw.step.name}
                          </span>
                          {i < steps.length - 1 && (
                            <ArrowRight
                              size={10}
                              className="mx-0.5 text-zinc-300"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ClipboardList size={16} className="text-zinc-300" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-[13px] text-zinc-500">
            {query ? "Brak wynikow" : "Brak produktow — dodaj pierwszy"}
          </p>
        </div>
      )}

      {showForm && <ProductForm onClose={() => setShowForm(false)} />}
    </>
  );
}
