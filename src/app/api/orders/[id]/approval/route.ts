import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { createApprovalToken, appUrl } from "@/lib/approval-token";
import { sendEmail } from "@/lib/email/resend";
import { designApprovalEmail } from "@/lib/email/templates";
import { APPROVAL_DEADLINE_HOURS } from "@/lib/approval";

/**
 * POST /api/orders/[id]/approval — wysyłka projektu do akceptacji klienta
 *
 * Body: { action: "send" | "resend" }
 *
 *  - "send"   — projekt idzie do klienta po raz pierwszy
 *  - "resend" — klient dostaje POPRAWIONĄ wersję, zegar 24 h startuje od nowa
 *
 * Za każdym razem powstaje NOWY jednorazowy link, a poprzedni przestaje
 * działać — inaczej klient mógłby zaakceptować nieaktualną wersję projektu.
 *
 * Osobny endpoint, bo przejście awaiting_approval -> awaiting_approval jest
 * (słusznie) zabronione w ALLOWED_TRANSITIONS, a licznik trzeba wyzerować.
 */
export const POST = withAuth(["admin", "operator"], async (request, { supabase, user }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { action } = parsed.data as Record<string, unknown>;

  if (action !== "send" && action !== "resend") {
    return NextResponse.json(
      { error: 'action musi byc "send" albo "resend"' },
      { status: 400 }
    );
  }

  const { data: order } = await supabase
    .from("orders")
    .select("status, order_number, approval_resent_count, approval_decision, contact:contacts(full_name, email)")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Zamówienie nie znalezione" }, { status: 404 });
  }

  // Poprawiona wersja projektu ma DWIE drogi:
  //  a) klient sie nie odezwal — zamowienie dalej wisi w awaiting_approval,
  //  b) klient poprosil o poprawki — zamowienie wrocilo na "Potwierdzone"
  //     i ma zapisana decyzje changes_requested.
  // Obie to ten sam ruch dla obslugi: "wyslalem poprawke".
  const poPoprawkach =
    order.status === "confirmed" && order.approval_decision === "changes_requested";

  if (action === "send") {
    if (order.status === "awaiting_approval") {
      return NextResponse.json(
        { error: 'Zamówienie już oczekuje na akceptację — użyj "wysłano poprawkę"' },
        { status: 400 }
      );
    }
    if (order.status !== "confirmed") {
      return NextResponse.json(
        { error: 'Projekt do akceptacji można wysłać tylko z etapu "Potwierdzone"' },
        { status: 400 }
      );
    }
  }

  if (action === "resend" && order.status !== "awaiting_approval" && !poPoprawkach) {
    return NextResponse.json(
      { error: "To zamówienie nie jest na etapie akceptacji projektu" },
      { status: 400 }
    );
  }

  // Klucz service_role — tabeli approval_tokens nie czyta ani nie zapisuje
  // żaden zalogowany użytkownik (RLS bez polityk)
  const admin = createAdminClient();
  const token = await createApprovalToken(admin, id);
  const link = `${appUrl()}/akceptacja/${token}`;

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status: "awaiting_approval",
    sent_for_approval_at: now,
    approval_reminder_sent: false,
    approved_at: null,
    approval_decision: null,
    approval_comment: null,
  };
  if (action === "resend" || poPoprawkach) {
    updateData.approval_resent_count = (order.approval_resent_count ?? 0) + 1;
  }

  const { error } = await supabase.from("orders").update(updateData).eq("id", id);

  if (error) {
    console.error("[APPROVAL] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  // Nazwy plików projektu (nasze, nie te wgrane przez klienta)
  const { data: files } = await admin
    .from("order_files")
    .select("file_name")
    .eq("order_id", id)
    .eq("is_client_upload", false)
    .order("created_at", { ascending: false });

  const contact = order.contact as unknown as { full_name: string; email: string | null } | null;

  let emailSent = false;
  if (contact?.email) {
    const { subject, html } = designApprovalEmail({
      orderNumber: order.order_number as string,
      customerName: contact.full_name,
      link,
      fileNames: (files ?? []).map((f) => f.file_name as string),
      isResend: action === "resend",
      deadlineHours: APPROVAL_DEADLINE_HOURS,
    });
    const result = await sendEmail({ to: contact.email, subject, html });
    emailSent = result !== null;
  }

  console.log(
    "[APPROVAL] %s orderId=%s user=%s mailWyslany=%s",
    action,
    id,
    user.id,
    emailSent
  );

  return NextResponse.json({
    ok: true,
    sentForApprovalAt: now,
    link,
    emailSent,
    // UI pokaże ostrzeżenie i sam link, gdy mail nie mógł pójść
    warning: !contact?.email
      ? "Klient nie ma zapisanego adresu e-mail — wyślij link ręcznie."
      : !emailSent
        ? "Nie udało się wysłać maila (brak konfiguracji Resend) — wyślij link ręcznie."
        : null,
  });
});
