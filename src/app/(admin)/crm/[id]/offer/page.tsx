"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Product {
  id: string;
  name: string;
  base_price: number | null;
}

interface OfferItem {
  product: string;
  quantity: number;
  unitPrice: number;
  description: string;
}

export default function OfferPage() {
  const params = useParams();
  const companyId = params.id as string;
  const supabase = createClient();

  const [company, setCompany] = useState<{
    name: string;
    nip: string | null;
    address: string | null;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<OfferItem[]>([
    { product: "", quantity: 1, unitPrice: 0, description: "" },
  ]);
  const [offerDate] = useState(
    new Date().toLocaleDateString("pl-PL")
  );
  const [validDays, setValidDays] = useState("14");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [companyRes, productsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("name, nip, address")
        .eq("id", companyId)
        .single(),
      supabase
        .from("products")
        .select("id, name, base_price")
        .eq("is_active", true)
        .order("name"),
    ]);
    setCompany(companyRes.data);
    setProducts(productsRes.data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function addItem() {
    setItems([
      ...items,
      { product: "", quantity: 1, unitPrice: 0, description: "" },
    ]);
  }

  function removeItem(i: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: string, value: string | number) {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    if (field === "product" && value) {
      const p = products.find((pr) => pr.name === value);
      if (p) {
        updated[i].description = p.name;
        updated[i].unitPrice = p.base_price ?? 0;
      }
    }
    setItems(updated);
  }

  const total = items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-zinc-400">Ladowanie...</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/crm/${companyId}`}
        className="mb-4 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={14} />
        Wstecz do firmy
      </Link>

      {/* Oferta do druku */}
      <div
        className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* Naglowek */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              OFERTA HANDLOWA
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Data: {offerDate}
            </p>
            <p className="text-[13px] text-zinc-500">
              Wazna:{" "}
              <input
                type="number"
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
                className="w-12 border-b border-zinc-300 text-center text-[13px] print:border-0"
              />{" "}
              dni
            </p>
          </div>
          <div className="text-right text-[13px]">
            <p className="font-semibold text-zinc-900">Grupa Plus</p>
            <p className="text-zinc-500">Drukarnia</p>
          </div>
        </div>

        {/* Odbiorca */}
        <div className="mb-6 rounded-lg bg-zinc-50 p-4 print:bg-transparent print:border print:border-zinc-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Odbiorca
          </p>
          <p className="mt-1 text-[15px] font-semibold text-zinc-900">
            {company?.name}
          </p>
          {company?.nip && (
            <p className="text-[13px] text-zinc-600">NIP: {company.nip}</p>
          )}
          {company?.address && (
            <p className="text-[13px] text-zinc-600">{company.address}</p>
          )}
        </div>

        {/* Pozycje */}
        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-zinc-200">
              <th className="py-2 text-left text-[12px] font-semibold text-zinc-500">
                Lp.
              </th>
              <th className="py-2 text-left text-[12px] font-semibold text-zinc-500">
                Produkt / Opis
              </th>
              <th className="py-2 text-right text-[12px] font-semibold text-zinc-500">
                Ilosc
              </th>
              <th className="py-2 text-right text-[12px] font-semibold text-zinc-500">
                Cena jed.
              </th>
              <th className="py-2 text-right text-[12px] font-semibold text-zinc-500">
                Wartosc
              </th>
              <th className="w-8 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-2 text-[13px] text-zinc-500">{i + 1}</td>
                <td className="py-2">
                  <select
                    value={item.product}
                    onChange={(e) => updateItem(i, "product", e.target.value)}
                    className="w-full border-0 bg-transparent text-[13px] text-zinc-900 focus:outline-none print:appearance-none"
                  >
                    <option value="">— Wybierz produkt —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(i, "description", e.target.value)
                    }
                    placeholder="Opis dodatkowy..."
                    className="mt-0.5 w-full border-0 bg-transparent text-[12px] text-zinc-500 placeholder:text-zinc-300 focus:outline-none"
                  />
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(i, "quantity", parseInt(e.target.value) || 1)
                    }
                    className="w-16 border-b border-zinc-200 text-right text-[13px] focus:outline-none print:border-0"
                  />
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(
                        i,
                        "unitPrice",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-20 border-b border-zinc-200 text-right text-[13px] focus:outline-none print:border-0"
                  />{" "}
                  zl
                </td>
                <td className="py-2 text-right text-[13px] font-medium text-zinc-900">
                  {(item.quantity * item.unitPrice).toFixed(2)} zl
                </td>
                <td className="py-2 print:hidden">
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(i)}
                      className="rounded p-1 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right text-[13px] font-semibold text-zinc-900">
                RAZEM:
              </td>
              <td className="pt-3 text-right text-[15px] font-bold text-zinc-900">
                {total.toFixed(2)} zl
              </td>
              <td className="print:hidden"></td>
            </tr>
          </tfoot>
        </table>

        {/* Dodaj pozycje */}
        <button
          onClick={addItem}
          className="mb-6 flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 print:hidden"
        >
          <Plus size={14} />
          Dodaj pozycje
        </button>

        {/* Uwagi */}
        <div className="mb-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Uwagi
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Dodatkowe warunki, terminy realizacji..."
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] placeholder:text-zinc-300 focus:outline-none print:border-0 print:p-0"
          />
        </div>

        {/* Drukuj */}
        <div className="flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800"
          >
            Drukuj / Zapisz PDF
          </button>
        </div>
      </div>
    </div>
  );
}
