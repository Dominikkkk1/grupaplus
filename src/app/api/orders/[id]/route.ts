import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_TRANSITIONS } from "@/lib/order-constants";
import { notifyOrderStatusChange } from "@/lib/email/notifications";

/**
 * PATCH /api/orders/[id] — zmiana statusu i/lub przypisania operatora
 * Body: { status?, assignedTo? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    (profile.role !== "admin" && profile.role !== "operator")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
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
      return NextResponse.json(
        { error: "Zamówienie nie znalezione" },
        { status: 404 }
      );
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(body.status)) {
      console.log("[ORDER PATCH] 400 — niedozwolone przejscie: %s → %s (allowed: %j)", order.status, body.status, allowed);
      return NextResponse.json(
        {
          error: `Nie można zmienić statusu z "${order.status}" na "${body.status}"`,
        },
        { status: 400 }
      );
    }

    console.log("[ORDER PATCH] status: %s → %s", order.status, body.status);
    updateData.status = body.status;
  }

  // Tracking number
  if (body.trackingNumber !== undefined) {
    updateData.tracking_number = body.trackingNumber || null;
  }

  // Przypisanie operatora
  if (body.assignedTo !== undefined) {
    updateData.assigned_to = body.assignedTo || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Brak danych do aktualizacji" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-shipped: dodanie tracking number przy statusie "ready" → automatycznie shipped
  if (body.trackingNumber && !body.status) {
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .single();

    if (currentOrder?.status === "ready") {
      console.log("[ORDER PATCH] auto-shipped: tracking added to ready order %s", id);
      await supabase.from("orders").update({ status: "shipped" }).eq("id", id);
      notifyOrderStatusChange(supabase, id, "shipped").catch((err) =>
        console.error("[ORDER PATCH] notify shipped error:", err)
      );
    }
  }

  // Powiadomienie email (fire-and-forget — nie blokuje response)
  if (body.status) {
    notifyOrderStatusChange(supabase, id, body.status).catch((err) =>
      console.error("[ORDER PATCH] notify error:", err)
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/orders/[id] — usuwanie zamówienia (admin only)
 * CASCADE automatycznie usunie: order_items, order_item_progress, order_files, complaints
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pobierz numer zamówienia do logu
  const { data: order } = await supabase
    .from("orders")
    .select("order_number")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Zamówienie nie znalezione" }, { status: 404 });
  }

  console.log("[ORDER DELETE] %s (id=%s) by user=%s", order.order_number, id, user.id);

  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[ORDER DELETE] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
