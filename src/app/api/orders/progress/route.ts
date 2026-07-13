import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { notifyOrderStatusChange } from "@/lib/email/notifications";

/**
 * PATCH /api/orders/progress — zmiana statusu etapu workflow
 * Body: { progressId, status, machineId? }
 */
export const PATCH = withAuth(["admin", "operator"], async (request, { supabase, user }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const { progressId, status, machineId } = body as { progressId: string; status: string; machineId?: string };
  console.log("[PROGRESS] progressId=%s newStatus=%s machineId=%s user=%s", progressId, status, machineId, user.id);

  if (!progressId || !status) {
    return NextResponse.json({ error: "progressId i status sa wymagane" }, { status: 400 });
  }

  const ALLOWED_STATUSES = ["pending", "in_progress", "completed", "skipped", "rework"];
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Nieprawidłowy status" }, { status: 400 });
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
      if (blockStepName !== "Projektowanie") {
        const { data: blockItem } = await supabase.from("order_items").select("order_id").eq("id", blockCheck.order_item_id).single();
        if (blockItem) {
          const { data: blockOrder } = await supabase.from("orders").select("status").eq("id", blockItem.order_id).single();
          if (blockOrder?.status === "awaiting_approval") {
            return NextResponse.json(
              { error: "Zamówienie oczekuje na akceptację projektu. Nie można kontynuować produkcji." },
              { status: 409 }
            );
          }
        }
      }

      // Blokada: niezaakceptowane pliki klienta
      const { data: blockItemForFiles } = await supabase.from("order_items").select("order_id").eq("id", blockCheck.order_item_id).single();
      if (blockItemForFiles) {
        const { data: unacceptedFiles } = await supabase
          .from("order_files").select("id")
          .eq("order_id", blockItemForFiles.order_id)
          .eq("is_client_upload", true).eq("is_accepted", false).limit(1);

        if (unacceptedFiles && unacceptedFiles.length > 0) {
          return NextResponse.json(
            { error: "Plik klienta oczekuje na akceptację. Zaakceptuj plik przed kontynuowaniem." },
            { status: 409 }
          );
        }
      }
    }
  }

  // Walidacja kolejnosci (branch-aware)
  if (status === "completed" || status === "skipped") {
    const { data: current } = await supabase
      .from("order_item_progress")
      .select("order_item_id, step_order, branch_type")
      .eq("id", progressId)
      .single();

    if (current) {
      const bt = current.branch_type ?? "common";

      if (bt === "common" && current.step_order >= 100) {
        const { data: branchSteps } = await supabase
          .from("order_item_progress").select("status, branch_type")
          .eq("order_item_id", current.order_item_id).in("branch_type", ["branch_a", "branch_b"]);

        if (branchSteps && branchSteps.length > 0) {
          const aOk = branchSteps.filter((s) => s.branch_type === "branch_a").every((s) => s.status === "completed" || s.status === "skipped");
          const bOk = branchSteps.filter((s) => s.branch_type === "branch_b").every((s) => s.status === "completed" || s.status === "skipped");
          if (!aOk || !bOk) {
            return NextResponse.json({ error: "Nie można zakończyć — oba branche muszą być ukończone (join)" }, { status: 400 });
          }
        }
      }

      if (current.step_order > 1 && !(bt === "common" && current.step_order === 101)) {
        const prevOrder = bt !== "common" && current.step_order === 1 ? null : current.step_order - 1;
        if (prevOrder !== null) {
          const { data: prev } = await supabase
            .from("order_item_progress").select("status")
            .eq("order_item_id", current.order_item_id).eq("branch_type", bt).eq("step_order", prevOrder).maybeSingle();

          if (prev && prev.status !== "completed" && prev.status !== "skipped") {
            return NextResponse.json({ error: "Poprzedni etap musi być ukończony" }, { status: 400 });
          }
        }
      }

      if ((bt === "branch_a" || bt === "branch_b") && current.step_order === 1) {
        const { data: preFork } = await supabase
          .from("order_item_progress").select("status")
          .eq("order_item_id", current.order_item_id).eq("branch_type", "common")
          .lt("step_order", 100).order("step_order", { ascending: false }).limit(1);

        if (preFork?.[0] && preFork[0].status !== "completed" && preFork[0].status !== "skipped") {
          return NextResponse.json({ error: "Poprzedni wspólny etap musi być ukończony" }, { status: 400 });
        }
      }
    }
  }

  // Walidacja cofania
  if (status !== "completed") {
    const { data: current } = await supabase
      .from("order_item_progress").select("order_item_id, step_order, branch_type").eq("id", progressId).single();

    if (current) {
      const revertBranch = current.branch_type ?? "common";
      const { data: laterCompleted } = await supabase
        .from("order_item_progress").select("id")
        .eq("order_item_id", current.order_item_id).eq("branch_type", revertBranch)
        .gt("step_order", current.step_order).eq("status", "completed").limit(1);

      if (laterCompleted && laterCompleted.length > 0) {
        return NextResponse.json({ error: "Nie mozna cofnąć — nastepny etap jest ukończony" }, { status: 400 });
      }
    }
  }

  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completed_by = user.id;
    updateData.completed_at = new Date().toISOString();
    if (machineId) updateData.machine_id = machineId;
  } else {
    updateData.completed_by = null;
    updateData.completed_at = null;
    updateData.machine_id = null;
    updateData.started_at = null;
    updateData.started_by = null;
  }

  const { error } = await supabase.from("order_item_progress").update(updateData).eq("id", progressId);
  if (error) {
    console.error("[PROGRESS] DB update error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  console.log("[PROGRESS] updated progressId=%s → %s", progressId, status);

  // Auto-revert: cofniecie kroku "Projektowanie"
  if (status !== "completed") {
    const { data: revertCheck } = await supabase
      .from("order_item_progress").select("order_item_id, step:workflow_steps(name)").eq("id", progressId).single();
    const revertStepName = (revertCheck?.step as unknown as { name: string })?.name;
    if (revertStepName === "Projektowanie" && revertCheck) {
      const { data: revertItem } = await supabase.from("order_items").select("order_id").eq("id", revertCheck.order_item_id).single();
      if (revertItem) {
        const { data: revertOrder } = await supabase.from("orders").select("status").eq("id", revertItem.order_id).single();
        if (revertOrder?.status === "awaiting_approval") {
          console.log("[PROGRESS] AUTO-REVERT: Projektowanie cofniete → order %s → confirmed", revertItem.order_id);
          await supabase.from("orders").update({ status: "confirmed", sent_for_approval_at: null, approval_reminder_sent: false }).eq("id", revertItem.order_id);
        }
      }
    }
  }

  // Auto-awaiting_approval: po zakonczeniu kroku "Projektowanie"
  if (status === "completed") {
    const { data: completedStep } = await supabase
      .from("order_item_progress").select("order_item_id, step:workflow_steps(name)").eq("id", progressId).single();
    const completedStepName = (completedStep?.step as unknown as { name: string })?.name;
    if (completedStepName === "Projektowanie" && completedStep) {
      const { data: projItem } = await supabase.from("order_items").select("order_id").eq("id", completedStep.order_item_id).single();
      if (projItem) {
        const { data: projOrder } = await supabase.from("orders").select("status").eq("id", projItem.order_id).single();
        if (projOrder && ["confirmed", "in_production"].includes(projOrder.status)) {
          console.log("[PROGRESS] AUTO: Projektowanie zakonczone → order %s → awaiting_approval", projItem.order_id);
          await supabase.from("orders").update({ status: "awaiting_approval", sent_for_approval_at: new Date().toISOString(), approval_reminder_sent: false }).eq("id", projItem.order_id);
        }
      }
    }
  }

  // Sprawdz czy wszystkie etapy pozycji sa ukończone
  const { data: progress } = await supabase.from("order_item_progress").select("order_item_id, status").eq("id", progressId).single();
  if (progress) {
    const { data: allSteps } = await supabase.from("order_item_progress").select("status").eq("order_item_id", progress.order_item_id);
    const allCompleted = allSteps?.every((s) => s.status === "completed" || s.status === "skipped");

    await supabase.from("order_items").update({ is_completed: !!allCompleted }).eq("id", progress.order_item_id);

    if (allCompleted) {
      const { data: orderItem } = await supabase.from("order_items").select("order_id").eq("id", progress.order_item_id).single();
      if (orderItem) {
        const { data: allItems } = await supabase.from("order_items").select("is_completed").eq("order_id", orderItem.order_id);
        const orderComplete = allItems?.every((i) => i.is_completed);
        if (orderComplete) {
          const { data: currentOrder } = await supabase.from("orders").select("status").eq("id", orderItem.order_id).single();
          if (currentOrder?.status === "in_production") {
            console.log("[PROGRESS] ORDER AUTO-ADVANCE: %s → ready", orderItem.order_id);
            await supabase.from("orders").update({ status: "ready" }).eq("id", orderItem.order_id);
            notifyOrderStatusChange(supabase, orderItem.order_id, "ready").catch((err) => console.error("[PROGRESS] notify ready error:", err));
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
});
