/**
 * Slownik przewoznikow.
 *
 * Dlaczego osobna kolumna, skoro jest juz `shipping_method`?
 * `shipping_method` to surowy tekst ze zrodla zamowienia — z WooCommerce
 * przychodzi nazwa metody wysylki ustawiona w sklepie, np. "flat rate",
 * "darmowa dostawa" albo "InPost Paczkomaty 24/7". Po czyms takim nie da sie
 * filtrowac, bo jeden przewoznik ma wiele nazw, a czesc nazw w ogole nie mowi,
 * kto wiezie paczke. `carrier` to zamknieta lista kodow i tylko ona trafia
 * do filtrow.
 */

export type CarrierCode =
  | "inpost"
  | "dpd"
  | "dhl"
  | "gls"
  | "poczta"
  | "ups"
  | "fedex"
  | "inny";

export const CARRIERS: { code: CarrierCode; label: string }[] = [
  { code: "inpost", label: "InPost" },
  { code: "dpd", label: "DPD" },
  { code: "dhl", label: "DHL" },
  { code: "gls", label: "GLS" },
  { code: "poczta", label: "Poczta Polska" },
  { code: "ups", label: "UPS" },
  { code: "fedex", label: "FedEx" },
  { code: "inny", label: "Inny kurier" },
];

export const CARRIER_LABELS: Record<string, string> = Object.fromEntries(
  CARRIERS.map((c) => [c.code, c.label])
);

/**
 * Grupy do widoku "Do wysylki".
 * Grupa Plus prosila wprost o rozdzielenie InPostu, DPD i reszty kurierow —
 * pakuja paczki pod godzine odbioru konkretnego przewoznika.
 */
export const CARRIER_GROUPS: { key: string; label: string; codes: CarrierCode[] }[] = [
  { key: "inpost", label: "InPost", codes: ["inpost"] },
  { key: "dpd", label: "DPD", codes: ["dpd"] },
  {
    key: "pozostali",
    label: "Pozostali kurierzy",
    codes: ["dhl", "gls", "poczta", "ups", "fedex", "inny"],
  },
];

export function isCarrierCode(value: unknown): value is CarrierCode {
  return typeof value === "string" && CARRIERS.some((c) => c.code === value);
}

/**
 * Zgaduje przewoznika z surowej nazwy metody wysylki.
 * Uzywane przy imporcie z WooCommerce — jesli nic nie pasuje, zwraca null
 * i przewoznika trzeba wybrac recznie (lepsze niz zle zgadniete).
 */
export function normalizeCarrier(raw?: string | null): CarrierCode | null {
  if (!raw) return null;
  const t = raw.toLowerCase();

  if (t.includes("inpost") || t.includes("paczkomat")) return "inpost";
  if (t.includes("dpd")) return "dpd";
  if (t.includes("dhl")) return "dhl";
  if (t.includes("gls")) return "gls";
  if (t.includes("pocztex") || t.includes("poczta") || t.includes("pocztow")) return "poczta";
  if (t.includes("fedex")) return "fedex";
  // "ups" sprawdzamy jako osobne slowo — inaczej zlapaloby np. "groupsend"
  if (/\bups\b/.test(t)) return "ups";

  return null;
}
