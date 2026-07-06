/**
 * Spójne formatowanie dat w całej aplikacji.
 */

/** Data: 06.07.2026 */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Data + czas: 06.07.2026, 14:32 */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
