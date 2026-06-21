import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange } from "@/lib/email/notifications";

/**
 * PATCH /api/orders/progress — zmiana statusu etapu workflow
 * Body: { progressId, status, machineId? }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tylko admin i operator moga zmieniac statusy etapow
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "operator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { progressId, status, machineId } = body;
  console.log("[PROGRESS] progressId=%s newStatus=%s machineId=%s user=%s", progressId, status, machineId, user.id);

  if (!progressId || !status) {
    return NextResponse.json(
      { error: "progressId i status sa wymagane" },
      { status: 400 }
    );
  }

  // Walidacja kolejnosci: nie mozna oznaczyc etapu jako completed
  // jesli poprzedni etap nie jest ukończony
  if (status === "completed") {
    const { data: current } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step_order")
      .eq("id", progressId)
      .single();

    if (current && current.step_order > 1) {
      const { data: prev } = await supabase
        .from("order_item_progress")
        .select("status")
        .eq("order_item_id", current.order_item_id)
        .eq("step_order", current.step_order - 1)
        .single();

      if (prev && prev.status !== "completed" && prev.status !== "skipped") {
        console.log("[PROGRESS] 400 — prev step status=%s, nie mozna complete", prev.status);
        return NextResponse.json(
          { error: "Poprzedni etap musi byc ukończony" },
          { status: 400 }
        );
      }
    }
  }

  // Walidacja cofania: nie mozna cofnąć etapu jesli nastepny jest ukończony
  if (status !== "completed") {
    const { data: current } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step_order")
      .eq("id", progressId)
      .single();

    if (current) {
      const { data: laterCompleted } = await supabase
        .from("order_item_progress")
        .select("id")
        .eq("order_item_id", current.order_item_id)
        .gt("step_order", current.step_order)
        .eq("status", "completed")
        .limit(1);

      if (laterCompleted && laterCompleted.length > 0) {
        console.log("[PROGRESS] 400 — nie mozna cofnąć, nastepny etap ukończony (ids=%j)", laterCompleted.map(l => l.id));
        return NextResponse.json(
          { error: "Nie mozna cofnąć — nastepny etap jest ukończony" },
          { status: 400 }
        );
      }
    }
  }

  const updateData: Record<string, unknown> = { status };

  if (status === "completed") {
    updateData.completed_by = user.id;
    updateData.completed_at = new Date().toISOString();
    if (machineId) updateData.machine_id = machineId;
  } else {
    // Cofanie — wyczysc dane (completed + started)
    updateData.completed_by = null;
    updateData.completed_at = null;
    updateData.machine_id = null;
    updateData.started_at = null;
    updateData.started_by = null;
  }

  const { error } = await supabase
    .from("order_item_progress")
    .update(updateData)
    .eq("id", progressId);

  if (error) {
    console.error("[PROGRESS] DB update error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[PROGRESS] updated progressId=%s → %s", progressId, status);

  // Sprawdz czy wszystkie etapy pozycji sa ukończone
  const { data: progress } = await supabase
    .from("order_item_progress")
    .select("order_item_id, status")
    .eq("id", progressId)
    .single();

  if (progress) {
    const { data: allSteps } = await supabase
      .from("order_item_progress")
      .select("status")
      .eq("order_item_id", progress.order_item_id);

    const allCompleted = allSteps?.every(
      (s) => s.status === "completed" || s.status === "skipped"
    );

    // Oznacz pozycje jako ukonczona
    console.log("[PROGRESS] item %s: allCompleted=%s", progress.order_item_id, !!allCompleted);
    await supabase
      .from("order_items")
      .update({ is_completed: !!allCompleted })
      .eq("id", progress.order_item_id);

    // Jesli wszystkie pozycje zamówienia ukończone → zmien status zamówienia
    if (allCompleted) {
      const { data: orderItem } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("id", progress.order_item_id)
        .single();

      if (orderItem) {
        const { data: allItems } = await supabase
          .from("order_items")
          .select("is_completed")
          .eq("order_id", orderItem.order_id);

        const orderComplete = allItems?.every((i) => i.is_completed);
        if (orderComplete) {
          // Tylko jesli zamówienie jest w produkcji — nie przeskakuj z "new"/"confirmed" do "ready"
          const { data: currentOrder } = await supabase
            .from("orders")
            .select("status")
            .eq("id", orderItem.order_id)
            .single();
          if (currentOrder?.status === "in_production") {
            console.log("[PROGRESS] ORDER AUTO-ADVANCE: %s → ready (all items done)", orderItem.order_id);
            await supabase
              .from("orders")
              .update({ status: "ready" })
              .eq("id", orderItem.order_id);

            notifyOrderStatusChange(supabase, orderItem.order_id, "ready").catch(
              (err) => console.error("[PROGRESS] notify ready error:", err)
            );
          } else {
            console.log("[PROGRESS] order %s status=%s — nie auto-advance (nie in_production)", orderItem.order_id, currentOrder?.status);
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
