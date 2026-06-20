import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  if (!process.env.RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY nie ustawiony — pomijam wysylke do %s", to);
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
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
