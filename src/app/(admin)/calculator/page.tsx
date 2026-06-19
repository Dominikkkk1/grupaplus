"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";

// Domyslne stawki — admin bedzie mogl je zmienic pozniej
const MATERIALS: Record<string, { label: string; pricePerSheet: number }> = {
  "350g": { label: "Kreda 350g", pricePerSheet: 1.2 },
  "300g": { label: "Kreda 300g", pricePerSheet: 1.0 },
  "250g": { label: "Kreda 250g", pricePerSheet: 0.8 },
  "170g": { label: "Kreda 170g", pricePerSheet: 0.5 },
  "130g": { label: "Kreda 130g", pricePerSheet: 0.35 },
};

const LAMINATES: Record<string, { label: string; pricePerSheet: number }> = {
  none: { label: "Bez laminatu", pricePerSheet: 0 },
  mat: { label: "Mat", pricePerSheet: 0.6 },
  bliss: { label: "Blysk", pricePerSheet: 0.6 },
  soft: { label: "Soft touch", pricePerSheet: 1.2 },
};

const PRINT_COST_PER_SHEET = 0.8; // koszt druku per arkusz
const CUT_COST = 0.1; // koszt ciecia per sztuka

// Marza wg ilosci (z transkryptu: 5-10 szt = 400%, 30-50 szt = 200%)
function getMarginMultiplier(qty: number): number {
  if (qty <= 10) return 4.0;
  if (qty <= 30) return 3.0;
  if (qty <= 50) return 2.0;
  if (qty <= 100) return 1.8;
  if (qty <= 500) return 1.5;
  return 1.3;
}

export default function CalculatorPage() {
  const [mode, setMode] = useState<"small" | "large">("small");
  const [showRates, setShowRates] = useState(false);

  // Edytowalne stawki
  const [printCost, setPrintCost] = useState(PRINT_COST_PER_SHEET);
  const [cutCost, setCutCost] = useState(CUT_COST);

  // Maly format
  const [material, setMaterial] = useState("350g");
  const [laminate, setLaminate] = useState("none");
  const [doubleSided, setDoubleSided] = useState(true);
  const [quantity, setQuantity] = useState(100);

  // Duzy format
  const [widthCm, setWidthCm] = useState(100);
  const [heightCm, setHeightCm] = useState(200);
  const [pricePerM2, setPricePerM2] = useState(45);

  // Kalkulacja — maly format
  const mat = MATERIALS[material];
  const lam = LAMINATES[laminate];
  const sheetsNeeded = Math.ceil(quantity / 8); // 8 sztuk na arkusz A3
  const printSides = doubleSided ? 2 : 1;
  const rawCost =
    sheetsNeeded * (mat.pricePerSheet + lam.pricePerSheet) +
    sheetsNeeded * printCost * printSides +
    quantity * cutCost;
  const margin = getMarginMultiplier(quantity);
  const totalSmall = rawCost * margin;
  const perPieceSmall = totalSmall / quantity;

  // Kalkulacja — duzy format
  const areaM2 = (widthCm / 100) * (heightCm / 100);
  const totalLarge = areaM2 * pricePerM2;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">
          Kalkulator cen
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Szybka wycena — dostosuj stawki do aktualnych cen materialow
        </p>
      </div>

      {/* Tryb */}
      <div className="mb-6 flex gap-2">
        {[
          { value: "small" as const, label: "Maly format (do A3)" },
          { value: "large" as const, label: "Duzy format (m\u00b2)" },
        ].map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
              mode === m.value
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Edycja stawek */}
      <div className="mb-6">
        <button
          onClick={() => setShowRates(!showRates)}
          className="text-[12px] font-medium text-zinc-500 hover:text-zinc-900"
        >
          {showRates ? "Ukryj stawki bazowe" : "Edytuj stawki bazowe"}
        </button>
        {showRates && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Druk (zl/arkusz)</label>
              <input type="number" step="0.01" value={printCost} onChange={(e) => setPrintCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Ciecie (zl/szt)</label>
              <input type="number" step="0.01" value={cutCost} onChange={(e) => setCutCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
          </div>
        )}
      </div>

      {mode === "small" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formularz */}
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Material
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none"
              >
                {Object.entries(MATERIALS).map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.label} ({m.pricePerSheet.toFixed(2)} zl/arkusz)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Laminat
              </label>
              <select
                value={laminate}
                onChange={(e) => setLaminate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none"
              >
                {Object.entries(LAMINATES).map(([key, l]) => (
                  <option key={key} value={key}>
                    {l.label}
                    {l.pricePerSheet > 0
                      ? ` (+${l.pricePerSheet.toFixed(2)} zl/arkusz)`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-zinc-700">
              <input
                type="checkbox"
                checked={doubleSided}
                onChange={(e) => setDoubleSided(e.target.checked)}
                className="rounded border-zinc-300"
              />
              Druk dwustronny
            </label>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Ilosc sztuk
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(parseInt(e.target.value) || 1)
                }
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Wynik */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-[14px] font-semibold text-zinc-900">
                Wycena
              </h2>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Material:</span>
                <span>{mat.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Laminat:</span>
                <span>{lam.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Druk:</span>
                <span>{doubleSided ? "Dwustronny" : "Jednostronny"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ilosc:</span>
                <span>{quantity} szt.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Arkuszy potrzebnych:</span>
                <span>{sheetsNeeded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Narzut ({((margin - 1) * 100).toFixed(0)}%):</span>
                <span>x{margin.toFixed(1)}</span>
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-[15px] font-bold text-zinc-900">
                  <span>RAZEM:</span>
                  <span>{totalSmall.toFixed(2)} zl</span>
                </div>
                <div className="mt-1 flex justify-between text-[12px] text-zinc-500">
                  <span>Za sztuke:</span>
                  <span>{perPieceSmall.toFixed(2)} zl</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formularz duzy format */}
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                  Szerokosc (cm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={widthCm}
                  onChange={(e) =>
                    setWidthCm(parseInt(e.target.value) || 1)
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                  Wysokosc (cm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={heightCm}
                  onChange={(e) =>
                    setHeightCm(parseInt(e.target.value) || 1)
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Cena za m² (zl)
              </label>
              <input
                type="number"
                step="0.01"
                value={pricePerM2}
                onChange={(e) =>
                  setPricePerM2(parseFloat(e.target.value) || 0)
                }
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Wynik duzy format */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-[14px] font-semibold text-zinc-900">
                Wycena
              </h2>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Wymiary:</span>
                <span>
                  {widthCm} x {heightCm} cm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Powierzchnia:</span>
                <span>{areaM2.toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Stawka:</span>
                <span>{pricePerM2.toFixed(2)} zl/m²</span>
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-[15px] font-bold text-zinc-900">
                  <span>RAZEM:</span>
                  <span>{totalLarge.toFixed(2)} zl</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
