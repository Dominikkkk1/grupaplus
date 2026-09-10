import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * POST /api/orders/[id]/approval — obsluga zegara akceptacji projektu
 *
 * Body: { action: "send" | "resend" }
 *
 *  - "send"   — projekt poszedl do klienta po raz pierwszy.
 *               Ustawia status `awaiting_approval` i startuje zegar 24 h.
 *  - "resend" — klient dostal POPRAWIONA wersje projektu.
 *               Zegar 24 h startuje od nowa (tego wymagala Grupa Plus).
 *
 * Dlaczego osobny endpoint, a nie zwykla zmiana statusu?
 * Bo przejscie `awaiting_approval -> awaiting_approval` jest zabronione
 * w ALLOWED_TRANSITIONS (i slusznie — status sie nie zmienia). Bez tego
 * nie dalo sie zresetowac licznika po wyslaniu poprawki.
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
    .select("status, approval_resent_count")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Zamówienie nie znalezione" }, { status: 404 });
  }

  const now = new Date().toISOString();

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

  if (action === "resend" && order.status !== "awaiting_approval") {
    return NextResponse.json(
      { error: "Zamówienie nie oczekuje na akceptację" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    status: "awaiting_approval",
    sent_for_approval_at: now,
    approval_reminder_sent: false,
    approved_at: null,
  };

  if (action === "resend") {
    updateData.approval_resent_count = (order.approval_resent_count ?? 0) + 1;
  }

  const { error } = await supabase.from("orders").update(updateData).eq("id", id);

  if (error) {
    console.error("[APPROVAL] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  console.log(
    "[APPROVAL] %s orderId=%s przez user=%s (zegar 24h wystartowal od nowa)",
    action,
    id,
    user.id
  );

  return NextResponse.json({ ok: true, sentForApprovalAt: now });
});
