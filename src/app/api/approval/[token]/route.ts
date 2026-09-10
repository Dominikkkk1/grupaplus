import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkApprovalToken } from "@/lib/approval-token";
import { sendEmail } from "@/lib/email/resend";
import { approvalDecisionEmail } from "@/lib/email/templates";
import { getActiveAdminEmails } from "@/lib/email/recipients";

/**
 * POST /api/approval/[token] — decyzja klienta w sprawie projektu
 *
 * PUBLICZNY endpoint (bez logowania). Autoryzacją jest sam token z linku:
 * jednorazowy, wygasający, przypisany do konkretnego zamówienia.
 *
 * Body: { decision: "approved" | "changes_requested", comment?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const decision = body.decision;
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 2000) : null;

  if (decision !== "approved" && decision !== "changes_requested") {
    return NextResponse.json({ error: "Nieprawidłowa decyzja" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const check = await checkApprovalToken(supabase, token);

  if (!check.ok) {
    const komunikat =
      check.reason === "used"
        ? "Ten link został już wykorzystany."
        : check.reason === "expired"
          ? "Link stracił ważność. Prosimy o kontakt z drukarnią."
          : "Nie znaleźliśmy takiego linku.";
    return NextResponse.json({ error: komunikat }, { status: 410 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, contact:contacts(full_name)")
    .eq("id", check.orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Zamówienie niedostępne" }, { status: 404 });
  }

  // Link mógł zostać otwarty po tym, jak ktoś ręcznie zmienił status
  if (order.status !== "awaiting_approval") {
    return NextResponse.json(
      { error: "To zamówienie nie czeka już na akceptację. Prosimy o kontakt z drukarnią." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const approved = decision === "approved";

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      // Akceptacja pcha do produkcji, prośba o poprawki cofa na "Potwierdzone"
      status: approved ? "in_production" : "confirmed",
      approved_at: approved ? now : null,
      approval_decision: decision,
      approval_comment: comment,
      approval_reminder_sent: false,
    })
    .eq("id", order.id);

  if (orderError) {
    console.error("[APPROVAL PUBLIC] blad zapisu zamowienia:", orderError.message);
    return NextResponse.json({ error: "Błąd zapisu. Prosimy spróbować ponownie." }, { status: 500 });
  }

  // Token zużyty — drugi raz już nie zadziała
  await supabase
    .from("approval_tokens")
    .update({ used_at: now, decision, comment })
    .eq("token", token);

  const contact = order.contact as unknown as { full_name: string } | null;

  console.log(
    "[APPROVAL PUBLIC] %s zamowienie=%s decyzja=%s",
    order.order_number,
    order.id,
    decision
  );

  // Powiadomienie zespołu — nie blokuje odpowiedzi dla klienta
  (async () => {
    const emails = await getActiveAdminEmails();
    if (emails.length === 0) return;
    const { subject, html } = approvalDecisionEmail({
      orderNumber: order.order_number as string,
      customerName: contact?.full_name ?? "—",
      decision,
      comment,
    });
    for (const email of emails) {
      await sendEmail({ to: email, subject, html });
    }
  })().catch((err) => console.error("[APPROVAL PUBLIC] blad powiadomienia:", err));

  return NextResponse.json({ ok: true, decision });
}
