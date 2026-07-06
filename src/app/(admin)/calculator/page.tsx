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

// Broszury — materialy wnetrza
const INTERIOR_MATERIALS: Record<string, { label: string; pricePerSheet: number }> = {
  "offset_80g": { label: "Offset 80g", pricePerSheet: 0.15 },
  "offset_90g": { label: "Offset 90g", pricePerSheet: 0.2 },
  "kreda_130g": { label: "Kreda 130g", pricePerSheet: 0.35 },
  "kreda_170g": { label: "Kreda 170g", pricePerSheet: 0.5 },
};

// Broszury — materialy okladki
const COVER_MATERIALS: Record<string, { label: string; pricePerSheet: number }> = {
  "kreda_300g": { label: "Kreda 300g", pricePerSheet: 1.0 },
  "kreda_350g": { label: "Kreda 350g", pricePerSheet: 1.2 },
};

// Broszury — formaty
const FORMATS: Record<string, { label: string; pagesPerSheet: number }> = {
  a4: { label: "A4", pagesPerSheet: 4 },
  a5: { label: "A5", pagesPerSheet: 8 },
  dl: { label: "DL (99x210mm)", pagesPerSheet: 6 },
};

const PRINT_COST_PER_SHEET = 0.8;
const CUT_COST = 0.1;
const BINDING_GLUE_COST = 1.5; // klejenie per szt
const BINDING_STAPLE_COST = 0.8; // zszywanie per szt
const BROCHURE_CUT_COST = 0.3; // ciecie broszury per szt

// Marza wg ilosci
function getMarginMultiplier(qty: number): number {
  if (qty <= 10) return 4.0;
  if (qty <= 30) return 3.0;
  if (qty <= 50) return 2.0;
  if (qty <= 100) return 1.8;
  if (qty <= 500) return 1.5;
  return 1.3;
}

type Mode = "small" | "large" | "brochure";

export default function CalculatorPage() {
  const [mode, setMode] = useState<Mode>("small");
  const [showRates, setShowRates] = useState(false);

  // Edytowalne stawki
  const [printCost, setPrintCost] = useState(PRINT_COST_PER_SHEET);
  const [cutCost, setCutCost] = useState(CUT_COST);
  const [glueCost, setGlueCost] = useState(BINDING_GLUE_COST);
  const [stapleCost, setStapleCost] = useState(BINDING_STAPLE_COST);
  const [brochureCutCost, setBrochureCutCost] = useState(BROCHURE_CUT_COST);

  // Maly format
  const [material, setMaterial] = useState("350g");
  const [laminate, setLaminate] = useState("none");
  const [doubleSided, setDoubleSided] = useState(true);
  const [quantity, setQuantity] = useState(100);

  // Duzy format
  const [widthCm, setWidthCm] = useState(100);
  const [heightCm, setHeightCm] = useState(200);
  const [pricePerM2, setPricePerM2] = useState(45);

  // Broszura
  const [brFormat, setBrFormat] = useState("a5");
  const [brPages, setBrPages] = useState(32);
  const [brInterior, setBrInterior] = useState("kreda_130g");
  const [brCover, setBrCover] = useState("kreda_300g");
  const [brLaminate, setBrLaminate] = useState("mat");
  const [brPrint, setBrPrint] = useState("4+4");
  const [brBinding, setBrBinding] = useState<"glue" | "staple">("glue");
  const [brQuantity, setBrQuantity] = useState(100);

  // ========= Kalkulacja — maly format =========
  const mat = MATERIALS[material];
  const lam = LAMINATES[laminate];
  const sheetsNeeded = Math.ceil(quantity / 8);
  const printSides = doubleSided ? 2 : 1;
  const rawCost =
    sheetsNeeded * (mat.pricePerSheet + lam.pricePerSheet) +
    sheetsNeeded * printCost * printSides +
    quantity * cutCost;
  const margin = getMarginMultiplier(quantity);
  const totalSmall = rawCost * margin;
  const perPieceSmall = totalSmall / quantity;

  // ========= Kalkulacja — duzy format =========
  const areaM2 = (widthCm / 100) * (heightCm / 100);
  const totalLarge = areaM2 * pricePerM2;

  // ========= Kalkulacja — broszura =========
  const brFmt = FORMATS[brFormat];
  const brInt = INTERIOR_MATERIALS[brInterior];
  const brCov = COVER_MATERIALS[brCover];
  const brLam = LAMINATES[brLaminate];
  const brPrintSides = brPrint === "4+4" ? 2 : brPrint === "4+0" ? 1 : 2; // 1+1 = 2 strony ale mono
  const brPrintCostMultiplier = brPrint === "1+1" ? 0.5 : 1; // mono tańszy

  const interiorSheets = Math.ceil(brPages / brFmt.pagesPerSheet);
  const coverSheets = 1;

  const costInteriorMaterial = interiorSheets * brInt.pricePerSheet;
  const costInteriorPrint = interiorSheets * printCost * brPrintSides * brPrintCostMultiplier;
  const costCoverMaterial = coverSheets * brCov.pricePerSheet;
  const costCoverPrint = coverSheets * printCost * 2; // okładka zawsze 4+4
  const costCoverLaminate = coverSheets * brLam.pricePerSheet;
  const costBinding = brBinding === "glue" ? glueCost : stapleCost;
  const costCut = brochureCutCost;

  const brRawPerPiece = costInteriorMaterial + costInteriorPrint + costCoverMaterial + costCoverPrint + costCoverLaminate + costBinding + costCut;
  const brMargin = getMarginMultiplier(brQuantity);
  const brTotalRaw = brRawPerPiece * brQuantity;
  const brTotal = brTotalRaw * brMargin;
  const brPerPiece = brTotal / brQuantity;

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
        {([
          { value: "small" as const, label: "Maly format" },
          { value: "large" as const, label: "Duzy format" },
          { value: "brochure" as const, label: "Broszury / Ksiazki" },
        ]).map((m) => (
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
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Druk (zl/arkusz)</label>
              <input type="number" step="0.01" value={printCost} onChange={(e) => setPrintCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Ciecie (zl/szt)</label>
              <input type="number" step="0.01" value={cutCost} onChange={(e) => setCutCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Klejenie (zl/szt)</label>
              <input type="number" step="0.01" value={glueCost} onChange={(e) => setGlueCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Szycie (zl/szt)</label>
              <input type="number" step="0.01" value={stapleCost} onChange={(e) => setStapleCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-500">Ciecie broszury (zl/szt)</label>
              <input type="number" step="0.01" value={brochureCutCost} onChange={(e) => setBrochureCutCost(parseFloat(e.target.value) || 0)} className="w-full rounded border border-zinc-300 px-2 py-1 text-[13px]" />
            </div>
          </div>
        )}
      </div>

      {mode === "small" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Material</label>
              <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                {Object.entries(MATERIALS).map(([key, m]) => (
                  <option key={key} value={key}>{m.label} ({m.pricePerSheet.toFixed(2)} zl/arkusz)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Laminat</label>
              <select value={laminate} onChange={(e) => setLaminate(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                {Object.entries(LAMINATES).map(([key, l]) => (
                  <option key={key} value={key}>{l.label}{l.pricePerSheet > 0 ? ` (+${l.pricePerSheet.toFixed(2)} zl/arkusz)` : ""}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-zinc-700">
              <input type="checkbox" checked={doubleSided} onChange={(e) => setDoubleSided(e.target.checked)} className="rounded border-zinc-300" />
              Druk dwustronny
            </label>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Ilosc sztuk</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none" />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-[14px] font-semibold text-zinc-900">Wycena</h2>
            </div>
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between"><span className="text-zinc-500">Material:</span><span>{mat.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Laminat:</span><span>{lam.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Druk:</span><span>{doubleSided ? "Dwustronny" : "Jednostronny"}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Ilosc:</span><span>{quantity} szt.</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Arkuszy:</span><span>{sheetsNeeded}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Narzut ({((margin - 1) * 100).toFixed(0)}%):</span><span>x{margin.toFixed(1)}</span></div>
              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-[15px] font-bold text-zinc-900"><span>RAZEM:</span><span>{totalSmall.toFixed(2)} zl</span></div>
                <div className="mt-1 flex justify-between text-[12px] text-zinc-500"><span>Za sztuke:</span><span>{perPieceSmall.toFixed(2)} zl</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "large" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Szerokosc (cm)</label>
                <input type="number" min={1} value={widthCm} onChange={(e) => setWidthCm(parseInt(e.target.value) || 1)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Wysokosc (cm)</label>
                <input type="number" min={1} value={heightCm} onChange={(e) => setHeightCm(parseInt(e.target.value) || 1)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Cena za m² (zl)</label>
              <input type="number" step="0.01" value={pricePerM2} onChange={(e) => setPricePerM2(parseFloat(e.target.value) || 0)} className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none" />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-[14px] font-semibold text-zinc-900">Wycena</h2>
            </div>
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between"><span className="text-zinc-500">Wymiary:</span><span>{widthCm} x {heightCm} cm</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Powierzchnia:</span><span>{areaM2.toFixed(2)} m²</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Stawka:</span><span>{pricePerM2.toFixed(2)} zl/m²</span></div>
              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-[15px] font-bold text-zinc-900"><span>RAZEM:</span><span>{totalLarge.toFixed(2)} zl</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "brochure" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formularz broszury */}
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Format</label>
                <select value={brFormat} onChange={(e) => setBrFormat(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                  {Object.entries(FORMATS).map(([key, f]) => (
                    <option key={key} value={key}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Stron wnetrza</label>
                <select value={brPages} onChange={(e) => setBrPages(parseInt(e.target.value))} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                  {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128].map((p) => (
                    <option key={p} value={p}>{p} stron</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Material wnetrza</label>
              <select value={brInterior} onChange={(e) => setBrInterior(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                {Object.entries(INTERIOR_MATERIALS).map(([key, m]) => (
                  <option key={key} value={key}>{m.label} ({m.pricePerSheet.toFixed(2)} zl/arkusz)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Material okladki</label>
                <select value={brCover} onChange={(e) => setBrCover(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                  {Object.entries(COVER_MATERIALS).map(([key, m]) => (
                    <option key={key} value={key}>{m.label} ({m.pricePerSheet.toFixed(2)} zl/arkusz)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Laminat okladki</label>
                <select value={brLaminate} onChange={(e) => setBrLaminate(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                  {Object.entries(LAMINATES).map(([key, l]) => (
                    <option key={key} value={key}>{l.label}{l.pricePerSheet > 0 ? ` (+${l.pricePerSheet.toFixed(2)} zl)` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Druk wnetrza</label>
                <select value={brPrint} onChange={(e) => setBrPrint(e.target.value)} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                  <option value="4+4">4+4 (kolor obie strony)</option>
                  <option value="4+0">4+0 (kolor jednostronny)</option>
                  <option value="1+1">1+1 (czarno-bialy)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Oprawa</label>
                <select value={brBinding} onChange={(e) => setBrBinding(e.target.value as "glue" | "staple")} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none">
                  <option value="glue">Klejona (miekka)</option>
                  <option value="staple">Zszywana (zeszytowa)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">Naklad</label>
              <input type="number" min={1} value={brQuantity} onChange={(e) => setBrQuantity(parseInt(e.target.value) || 1)} className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none" />
            </div>
          </div>

          {/* Wynik broszury */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calculator size={18} className="text-zinc-400" />
              <h2 className="text-[14px] font-semibold text-zinc-900">Wycena broszury</h2>
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-zinc-500">Format:</span><span>{brFmt.label}, {brPages} stron + okladka</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Wnetrze:</span><span>{brInt.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Okladka:</span><span>{brCov.label} + {brLam.label}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Druk wnetrza:</span><span>{brPrint}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Oprawa:</span><span>{brBinding === "glue" ? "Klejona" : "Zszywana"}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Arkuszy wnetrza:</span><span>{interiorSheets}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Naklad:</span><span>{brQuantity} szt.</span></div>

              {/* Breakdown */}
              <div className="mt-2 border-t border-zinc-100 pt-2 text-[12px] text-zinc-400">
                <p>Papier wnetrze: {costInteriorMaterial.toFixed(2)} zl</p>
                <p>Druk wnetrze: {costInteriorPrint.toFixed(2)} zl</p>
                <p>Papier okladka: {costCoverMaterial.toFixed(2)} zl</p>
                <p>Druk okladka: {costCoverPrint.toFixed(2)} zl</p>
                <p>Laminat okladka: {costCoverLaminate.toFixed(2)} zl</p>
                <p>Oprawa: {costBinding.toFixed(2)} zl</p>
                <p>Ciecie: {costCut.toFixed(2)} zl</p>
                <p className="font-medium text-zinc-500">Koszt surowca/szt: {brRawPerPiece.toFixed(2)} zl</p>
              </div>

              <div className="flex justify-between text-zinc-500">
                <span>Narzut ({((brMargin - 1) * 100).toFixed(0)}%):</span>
                <span>x{brMargin.toFixed(1)}</span>
              </div>

              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-[15px] font-bold text-zinc-900"><span>RAZEM:</span><span>{brTotal.toFixed(2)} zl</span></div>
                <div className="mt-1 flex justify-between text-[12px] text-zinc-500"><span>Za sztuke:</span><span>{brPerPiece.toFixed(2)} zl</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
