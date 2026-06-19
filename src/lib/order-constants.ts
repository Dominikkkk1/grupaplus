/**
 * Wspolne stale dla zamowien — uzywane w liscie, szczegolach i innych widokach.
 * Jedno zrodlo prawdy (DRY) — zmieniasz tutaj, zmienia sie wszedzie.
 */

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "Nowe", color: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Potwierdzone", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  in_production: { label: "W produkcji", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ready: { label: "Gotowe", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  shipped: { label: "Wyslane", color: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered: { label: "Dostarczone", color: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  cancelled: { label: "Anulowane", color: "bg-red-50 text-red-700 border-red-200" },
};

/**
 * Uproszczone statusy dla klienta — widzi tylko 4 etapy zamiast 7.
 * Mapuje wewnetrzne statusy DB na czytelne statusy klienta.
 */
export function getClientStatus(dbStatus: string): { label: string; color: string } {
  switch (dbStatus) {
    case "new":
    case "confirmed":
      return { label: "Przyjete do realizacji", color: "bg-blue-50 text-blue-700 border-blue-200" };
    case "in_production":
    case "ready":
      return { label: "W realizacji", color: "bg-amber-50 text-amber-700 border-amber-200" };
    case "shipped":
    case "delivered":
      return { label: "Wyslane", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "cancelled":
      return { label: "Anulowane", color: "bg-red-50 text-red-700 border-red-200" };
    default:
      return { label: dbStatus, color: "bg-zinc-50 text-zinc-600 border-zinc-200" };
  }
}

export const SOURCE_LABELS: Record<string, string> = {
  allegro: "Allegro",
  woo: "Sklep WWW",
  email: "Email",
  stacjonarne: "Stacjonarne",
  baselinker: "BaseLinker",
};
