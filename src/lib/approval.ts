/**
 * Logika przypomnien o braku akceptacji projektu.
 *
 * Zasada od Grupy Plus: projekt poszedl do klienta, minely 24 godziny i nie ma
 * ani akceptacji, ani odpowiedzi -> pracownik ma zobaczyc powiadomienie.
 * Po wyslaniu POPRAWIONEJ wersji zegar startuje od zera.
 *
 * Zegar to pole `orders.sent_for_approval_at`, ustawiane przy wejsciu w status
 * `awaiting_approval` i przestawiane przez akcje "wyslalem poprawke"
 * (POST /api/orders/[id]/approval).
 */

export const APPROVAL_DEADLINE_HOURS = 24;

/** Ile pelnych godzin czekamy na akceptacje. null = zamowienie nie czeka. */
export function approvalWaitingHours(
  sentForApprovalAt: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!sentForApprovalAt) return null;
  const sent = new Date(sentForApprovalAt).getTime();
  if (Number.isNaN(sent)) return null;
  return Math.floor((now.getTime() - sent) / (1000 * 60 * 60));
}

export function isApprovalOverdue(
  sentForApprovalAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  const h = approvalWaitingHours(sentForApprovalAt, now);
  return h !== null && h >= APPROVAL_DEADLINE_HOURS;
}

/** "3 h", "1 dzień 5 h", "2 dni 1 h" — po polsku, z odmiana. */
export function formatWaitingTime(hours: number): string {
  if (hours < 1) return "mniej niż godzinę";
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const dayWord = days === 1 ? "dzień" : "dni";
  return rest === 0 ? `${days} ${dayWord}` : `${days} ${dayWord} ${rest} h`;
}

/**
 * Moment, przed ktorym wyslany projekt uznajemy za przeterminowany.
 * Gotowy ISO do zapytan `.lt("sent_for_approval_at", ...)`.
 */
export function approvalCutoffISO(now: Date = new Date()): string {
  return new Date(now.getTime() - APPROVAL_DEADLINE_HOURS * 60 * 60 * 1000).toISOString();
}
