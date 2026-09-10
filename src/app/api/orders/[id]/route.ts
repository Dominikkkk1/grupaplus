import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { ALLOWED_TRANSITIONS } from "@/lib/order-constants";
import { notifyOrderStatusChange } from "@/lib/email/notifications";
import { isCarrierCode } from "@/lib/carriers";

/**
 * PATCH /api/orders/[id] — zmiana statusu i/lub przypisania operatora
 */
export const PATCH = withAuth(["admin", "operator"], async (request, { supabase, user }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  console.log("[ORDER PATCH] orderId=%s body=%j user=%s", id, body, user.id);

  // Zmiana statusu — walidacja przejsc
  if (body.status) {
    const { data: order } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Zamówienie nie znalezione" }, { status: 404 });
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(body.status as string)) {
      console.log("[ORDER PATCH] 400 — niedozwolone przejscie: %s → %s (allowed: %j)", order.status, body.status, allowed);
      return NextResponse.json(
        { error: `Nie można zmienić statusu z "${order.status}" na "${body.status}"` },
        { status: 400 }
      );
    }

    console.log("[ORDER PATCH] status: %s → %s", order.status, body.status);
    updateData.status = body.status;

    if (body.status === "awaiting_approval") {
      updateData.sent_for_approval_at = new Date().toISOString();
      updateData.approval_reminder_sent = false;
    }
    if (order.status === "awaiting_approval" && body.status !== "awaiting_approval") {
      // sent_for_approval_at ZOSTAJE — to historia (kiedy projekt poszedl do klienta).
      // Przypomnienia i tak filtruja po status = 'awaiting_approval', wiec stara data
      // nikomu nie przeszkadza, a jej skasowanie bezpowrotnie tracilo informacje.
      updateData.approval_reminder_sent = false;
    }

    // Moment faktycznej wysylki — osobne pole, bo updated_at zmienia sie przy
    // kazdej edycji zamowienia (np. dopisaniu notatki) i resetowalby licznik
    // automatu "po 7 dniach oznacz jako dostarczone".
    if (body.status === "shipped") {
      updateData.shipped_at = new Date().toISOString();
    }

    // Klient zaakceptowal projekt i produkcja rusza dalej — zapisujemy moment
    // akceptacji, zeby dalo sie policzyc, ile realnie trwalo czekanie.
    if (order.status === "awaiting_approval" && body.status === "in_production") {
      updateData.approved_at = new Date().toISOString();
    }
  }

  if (body.trackingNumber !== undefined) updateData.tracking_number = body.trackingNumber || null;

  // Przewoznik — tylko wartosci ze slownika (kolumna ma CHECK, wiec zla wartosc
  // i tak by przeszla bledem z bazy; lepiej odpowiedziec czytelnie)
  if (body.carrier !== undefined) {
    if (body.carrier && !isCarrierCode(body.carrier)) {
      return NextResponse.json({ error: "Nieznany przewoźnik" }, { status: 400 });
    }
    updateData.carrier = body.carrier || null;
  }
  if (body.shippingMethod !== undefined) {
    updateData.shipping_method = body.shippingMethod || null;
  }
  if (body.assignedTo !== undefined) updateData.assigned_to = body.assignedTo || null;
  if (body.isPriority !== undefined) updateData.is_priority = !!body.isPriority;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
  }

  const { error } = await supabase.from("orders").update(updateData).eq("id", id);

  if (error) {
    console.error("[ORDERS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  // Auto-shipped: dodanie tracking number przy statusie "ready"
  if (body.trackingNumber && !body.status) {
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .single();

    if (currentOrder?.status === "ready") {
      console.log("[ORDER PATCH] auto-shipped: tracking added to ready order %s", id);
      await supabase
        .from("orders")
        .update({ status: "shipped", shipped_at: new Date().toISOString() })
        .eq("id", id);
      notifyOrderStatusChange(supabase, id, "shipped").catch((err) =>
        console.error("[ORDER PATCH] notify shipped error:", err)
      );
    }
  }

  if (body.status) {
    notifyOrderStatusChange(supabase, id, body.status as string).catch((err) =>
      console.error("[ORDER PATCH] notify error:", err)
    );
  }

  return NextResponse.json({ ok: true });
});

/**
 * DELETE /api/orders/[id] — usuwanie zamówienia (admin only)
 */
export const DELETE = withAuth("admin", async (_request, { supabase, user }, params) => {
  const id = params!.id;

  const { data: order } = await supabase
    .from("orders")
    .select("order_number")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Zamówienie nie znalezione" }, { status: 404 });
  }

  console.log("[ORDER DELETE] %s (id=%s) by user=%s", order.order_number, id, user.id);

  const { error } = await supabase.from("orders").delete().eq("id", id);

  if (error) {
    console.error("[ORDER DELETE] error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
