/**
 * Uprawnienia do stron — JEDNO zrodlo prawdy.
 *
 * Wczesniej role byly pilnowane wylacznie w menu bocznym (sidebar chowal linki),
 * a to nie jest zabezpieczenie: wystarczylo wpisac adres recznie, zeby operator
 * albo klient wszedl na /crm czy /settings/users. Dane ratowalo RLS, ale to
 * ochrona "przez przypadek" — jedno zapytanie service_role w komponencie
 * serwerowym i mamy wyciek.
 *
 * Tej tabeli uzywaja teraz OBA miejsca: layout (twardy redirect) i sidebar
 * (filtrowanie linkow).
 */

export type Role = "admin" | "operator" | "client";

export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/dashboard", roles: ["admin"] },
  { prefix: "/orders", roles: ["admin", "operator", "client"] },
  { prefix: "/production", roles: ["admin", "operator"] },
  { prefix: "/shipping", roles: ["admin", "operator"] },
  { prefix: "/scan", roles: ["admin", "operator"] },
  { prefix: "/crm", roles: ["admin"] },
  { prefix: "/products", roles: ["admin"] },
  { prefix: "/machines", roles: ["admin"] },
  { prefix: "/calculator", roles: ["admin"] },
  { prefix: "/settings", roles: ["admin"] },
];

/** Strona, na ktora trafia kazdy — dostepna dla wszystkich trzech rol. */
export const DEFAULT_ROUTE = "/orders";

export function canAccess(pathname: string, role: string): boolean {
  const entry = ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
  // Sciezka spoza tabeli (np. "/") — nie blokujemy, decyduje sama strona.
  if (!entry) return true;
  return (entry.roles as string[]).includes(role);
}
