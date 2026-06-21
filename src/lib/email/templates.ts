/**
 * Szablony email dla powiadomień o zamówieniach.
 * Prosty HTML inline — działa w każdym kliencie pocztowym.
 */

function layout(content: string) {
  return `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">Grupa Plus</h1>
    </div>
    <div style="padding:24px;">
      ${content}
    </div>
    <div style="padding:16px 24px;background:#f4f4f5;text-align:center;font-size:12px;color:#71717a;">
      Drukarnia Grupa Plus &middot; Sanok
    </div>
  </div>
</body>
</html>`;
}

export function orderConfirmedEmail({
  orderNumber,
  customerName,
  items,
}: {
  orderNumber: string;
  customerName: string;
  items: { description: string; quantity: number }[];
}) {
  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f4f4f5;font-size:14px;">${i.description}</td><td style="padding:6px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:right;white-space:nowrap;">${i.quantity} szt.</td></tr>`
    )
    .join("");

  return {
    subject: `Zamówienie ${orderNumber} — potwierdzone`,
    html: layout(`
      <p style="margin:0 0 8px;font-size:15px;color:#18181b;">Cześć <strong>${customerName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;">Twoje zamówienie <strong>${orderNumber}</strong> zostało potwierdzone i wkrótce rozpoczniemy realizację.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr><th style="text-align:left;padding:6px 0;font-size:12px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Pozycja</th><th style="text-align:right;padding:6px 0;font-size:12px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Ilość</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <p style="margin:0;font-size:13px;color:#71717a;">Poinformujemy Cię mailem gdy zamówienie będzie wysłane.</p>
    `),
  };
}

export function orderReadyEmail({
  orderNumber,
  customerName,
}: {
  orderNumber: string;
  customerName: string;
}) {
  return {
    subject: `Zamówienie ${orderNumber} — gotowe!`,
    html: layout(`
      <p style="margin:0 0 8px;font-size:15px;color:#18181b;">Cześć <strong>${customerName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">Twoje zamówienie <strong>${orderNumber}</strong> jest gotowe do odbioru lub wysyłki.</p>

      <div style="margin:16px 0;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#1e40af;">Skontaktujemy się z Tobą w sprawie odbioru lub wysyłki.</p>
      </div>

      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">Dziękujemy za zamówienie w Drukarni Grupa Plus.</p>
    `),
  };
}

export function complaintEmail({
  orderNumber,
  type,
  reason,
  reporterName,
}: {
  orderNumber: string;
  type: string;
  reason: string;
  reporterName: string;
}) {
  const typeLabel = type === "external" ? "Reklamacja klienta" : "Incydent wewnętrzny";
  const typeBg = type === "external" ? "#fef2f2" : "#fffbeb";
  const typeBorder = type === "external" ? "#fecaca" : "#fde68a";
  const typeColor = type === "external" ? "#991b1b" : "#92400e";

  return {
    subject: `${typeLabel} — ${orderNumber}`,
    html: layout(`
      <div style="margin:0 0 16px;padding:12px 16px;background:${typeBg};border:1px solid ${typeBorder};border-radius:8px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:${typeColor};">${typeLabel}</p>
      </div>

      <p style="margin:0 0 8px;font-size:14px;color:#18181b;">Zamówienie: <strong>${orderNumber}</strong></p>
      <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">Zgłosił: <strong>${reporterName}</strong></p>

      <div style="margin:16px 0;padding:12px 16px;background:#f4f4f5;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#18181b;">${reason}</p>
      </div>

      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">Sprawdź szczegóły w systemie.</p>
    `),
  };
}

export function deadlineDigestEmail({
  overdue,
  approaching,
}: {
  overdue: { order_number: string; status: string; deadline: string; customer: string }[];
  approaching: { order_number: string; status: string; deadline: string; customer: string }[];
}) {
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function orderRows(orders: typeof overdue, color: string) {
    return orders
      .map(
        (o) =>
          `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;font-size:13px;font-weight:600;color:${color};">${o.order_number}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;font-size:13px;">${o.customer}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;font-size:13px;">${o.status}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5;font-size:13px;text-align:right;">${formatDate(o.deadline)}</td>
          </tr>`
      )
      .join("");
  }

  const overdueSection =
    overdue.length > 0
      ? `<div style="margin:0 0 20px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#dc2626;">Po terminie (${overdue.length})</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="text-align:left;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Nr</th>
              <th style="text-align:left;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Klient</th>
              <th style="text-align:left;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Status</th>
              <th style="text-align:right;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Deadline</th>
            </tr></thead>
            <tbody>${orderRows(overdue, "#dc2626")}</tbody>
          </table>
        </div>`
      : "";

  const approachingSection =
    approaching.length > 0
      ? `<div style="margin:0 0 20px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#d97706;">Zbliżający się termin (${approaching.length})</p>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="text-align:left;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Nr</th>
              <th style="text-align:left;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Klient</th>
              <th style="text-align:left;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Status</th>
              <th style="text-align:right;padding:4px 8px;font-size:11px;color:#71717a;text-transform:uppercase;border-bottom:2px solid #e4e4e7;">Deadline</th>
            </tr></thead>
            <tbody>${orderRows(approaching, "#d97706")}</tbody>
          </table>
        </div>`
      : "";

  return {
    subject: `Terminy zamówień — ${overdue.length} po terminie, ${approaching.length} zbliżających się`,
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;color:#18181b;">Raport terminów zamówień</p>
      ${overdueSection}
      ${approachingSection}
      <p style="margin:0;font-size:13px;color:#71717a;">Wygenerowano automatycznie.</p>
    `),
  };
}

export function orderShippedEmail({
  orderNumber,
  customerName,
  trackingNumber,
  shippingMethod,
}: {
  orderNumber: string;
  customerName: string;
  trackingNumber?: string | null;
  shippingMethod?: string | null;
}) {
  const trackingSection = trackingNumber
    ? `<div style="margin:16px 0;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
         <p style="margin:0;font-size:13px;color:#166534;"><strong>Numer przesyłki:</strong> ${trackingNumber}</p>
         ${shippingMethod ? `<p style="margin:4px 0 0;font-size:12px;color:#166534;">Metoda: ${shippingMethod}</p>` : ""}
       </div>`
    : "";

  return {
    subject: `Zamówienie ${orderNumber} — wysłane!`,
    html: layout(`
      <p style="margin:0 0 8px;font-size:15px;color:#18181b;">Cześć <strong>${customerName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">Twoje zamówienie <strong>${orderNumber}</strong> zostało wysłane! 🎉</p>

      ${trackingSection}

      <p style="margin:16px 0 0;font-size:13px;color:#71717a;">Dziękujemy za zamówienie w Drukarni Grupa Plus.</p>
    `),
  };
}
