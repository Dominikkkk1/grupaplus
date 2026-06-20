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
