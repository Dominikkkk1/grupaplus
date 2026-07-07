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

  // Blokada: nie mozna startowac ani konczyc krokow jesli zamowienie oczekuje na akceptacje projektu
  if (status === "completed" || status === "in_progress") {
    const { data: blockCheck } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step:workflow_steps(name)")
      .eq("id", progressId)
      .single();
    if (blockCheck) {
      const blockStepName = (blockCheck.step as unknown as { name: string })?.name;
      // Krok "Projektowanie" mozna zakonczyc — ale inne kroki nie jesli awaiting_approval
      if (blockStepName !== "Projektowanie") {
        const { data: blockItem } = await supabase
          .from("order_items")
          .select("order_id")
          .eq("id", blockCheck.order_item_id)
          .single();
        if (blockItem) {
          const { data: blockOrder } = await supabase
            .from("orders")
            .select("status")
            .eq("id", blockItem.order_id)
            .single();
          if (blockOrder?.status === "awaiting_approval") {
            return NextResponse.json(
              { error: "Zamówienie oczekuje na akceptację projektu. Nie można kontynuować produkcji." },
              { status: 409 }
            );
          }
        }
      }
    }
  }

  // Walidacja kolejnosci (branch-aware): nie mozna oznaczyc etapu jako completed
  // jesli poprzedni etap nie jest ukończony
  if (status === "completed") {
    const { data: current } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step_order, branch_type")
      .eq("id", progressId)
      .single();

    if (current) {
      const bt = current.branch_type ?? "common";

      if (bt === "common" && current.step_order >= 100) {
        // Post-join common: czekaj az oba branche done
        const { data: branchSteps } = await supabase
          .from("order_item_progress")
          .select("status, branch_type")
          .eq("order_item_id", current.order_item_id)
          .in("branch_type", ["branch_a", "branch_b"]);

        if (branchSteps && branchSteps.length > 0) {
          const aOk = branchSteps.filter((s) => s.branch_type === "branch_a").every((s) => s.status === "completed" || s.status === "skipped");
          const bOk = branchSteps.filter((s) => s.branch_type === "branch_b").every((s) => s.status === "completed" || s.status === "skipped");
          if (!aOk || !bOk) {
            return NextResponse.json({ error: "Nie można zakończyć — oba branche muszą być ukończone (join)" }, { status: 400 });
          }
        }
      }

      // Standardowa walidacja: poprzedni krok w TYM SAMYM branchu
      if (current.step_order > 1 && !(bt === "common" && current.step_order >= 100 && current.step_order === 101)) {
        const prevOrder = bt !== "common" && current.step_order === 1
          ? null  // Pierwszy w branchu — sprawdzamy pre-fork common osobno
          : current.step_order - 1;

        if (prevOrder !== null) {
          const { data: prev } = await supabase
            .from("order_item_progress")
            .select("status")
            .eq("order_item_id", current.order_item_id)
            .eq("branch_type", bt)
            .eq("step_order", prevOrder)
            .maybeSingle();

          if (prev && prev.status !== "completed" && prev.status !== "skipped") {
            return NextResponse.json({ error: "Poprzedni etap musi być ukończony" }, { status: 400 });
          }
        }
      }

      // Pierwszy krok w branchu: sprawdz ostatni pre-fork common
      if ((bt === "branch_a" || bt === "branch_b") && current.step_order === 1) {
        const { data: preFork } = await supabase
          .from("order_item_progress")
          .select("status")
          .eq("order_item_id", current.order_item_id)
          .eq("branch_type", "common")
          .lt("step_order", 100)
          .order("step_order", { ascending: false })
          .limit(1);

        if (preFork?.[0] && preFork[0].status !== "completed" && preFork[0].status !== "skipped") {
          return NextResponse.json({ error: "Poprzedni wspólny etap musi być ukończony" }, { status: 400 });
        }
      }
    }
  }

  // Walidacja cofania (branch-aware): nie mozna cofnąć etapu jesli nastepny w TYM SAMYM branchu jest ukończony
  if (status !== "completed") {
    const { data: current } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step_order, branch_type")
      .eq("id", progressId)
      .single();

    if (current) {
      const revertBranch = current.branch_type ?? "common";
      const { data: laterCompleted } = await supabase
        .from("order_item_progress")
        .select("id")
        .eq("order_item_id", current.order_item_id)
        .eq("branch_type", revertBranch)
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

  // Auto-revert: cofniecie kroku "Projektowanie" → zamowienie wraca z awaiting_approval do confirmed
  if (status !== "completed") {
    const { data: revertCheck } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step:workflow_steps(name)")
      .eq("id", progressId)
      .single();
    const revertStepName = (revertCheck?.step as unknown as { name: string })?.name;
    if (revertStepName === "Projektowanie" && revertCheck) {
      const { data: revertItem } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("id", revertCheck.order_item_id)
        .single();
      if (revertItem) {
        const { data: revertOrder } = await supabase
          .from("orders")
          .select("status")
          .eq("id", revertItem.order_id)
          .single();
        if (revertOrder?.status === "awaiting_approval") {
          console.log("[PROGRESS] AUTO-REVERT: Projektowanie cofniete → order %s → confirmed", revertItem.order_id);
          await supabase
            .from("orders")
            .update({
              status: "confirmed",
              sent_for_approval_at: null,
              approval_reminder_sent: false,
            })
            .eq("id", revertItem.order_id);
        }
      }
    }
  }

  // Auto-awaiting_approval: po zakonczeniu kroku "Projektowanie"
  if (status === "completed") {
    const { data: completedStep } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step:workflow_steps(name)")
      .eq("id", progressId)
      .single();
    const completedStepName = (completedStep?.step as unknown as { name: string })?.name;
    if (completedStepName === "Projektowanie" && completedStep) {
      const { data: projItem } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("id", completedStep.order_item_id)
        .single();
      if (projItem) {
        const { data: projOrder } = await supabase
          .from("orders")
          .select("status")
          .eq("id", projItem.order_id)
          .single();
        if (projOrder && ["confirmed", "in_production"].includes(projOrder.status)) {
          console.log("[PROGRESS] AUTO: Projektowanie zakonczone → order %s → awaiting_approval", projItem.order_id);
          await supabase
            .from("orders")
            .update({
              status: "awaiting_approval",
              sent_for_approval_at: new Date().toISOString(),
              approval_reminder_sent: false,
            })
            .eq("id", projItem.order_id);
        }
      }
    }
  }

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
