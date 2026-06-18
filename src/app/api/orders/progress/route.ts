import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const body = await request.json();
  const { progressId, status, machineId } = body;

  if (!progressId || !status) {
    return NextResponse.json(
      { error: "progressId i status sa wymagane" },
      { status: 400 }
    );
  }

  // Walidacja kolejnosci: nie mozna oznaczyc etapu jako completed
  // jesli poprzedni etap nie jest ukonczony
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
        return NextResponse.json(
          { error: "Poprzedni etap musi byc ukonczony" },
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
    // Cofanie — wyczysc dane
    updateData.completed_by = null;
    updateData.completed_at = null;
    updateData.machine_id = null;
  }

  const { error } = await supabase
    .from("order_item_progress")
    .update(updateData)
    .eq("id", progressId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sprawdz czy wszystkie etapy pozycji sa ukonczone
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
    await supabase
      .from("order_items")
      .update({ is_completed: !!allCompleted })
      .eq("id", progress.order_item_id);

    // Jesli wszystkie pozycje zamowienia ukonczone → zmien status zamowienia
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
          await supabase
            .from("orders")
            .update({ status: "ready" })
            .eq("id", orderItem.order_id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
