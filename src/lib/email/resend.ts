import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM ?? "zamowienia@grupa-plus.pl";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const client = getResend();
  if (!client) {
    console.warn("[EMAIL] RESEND_API_KEY nie ustawiony — pomijam wysylke do %s", to);
    return null;
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[EMAIL] Resend error:", error.message);
      return null;
    }

    console.log("[EMAIL] wyslano do %s: %s (id=%s)", to, subject, data?.id);
    return data;
  } catch (err) {
    console.error("[EMAIL] exception:", err);
    return null;
  }
}
