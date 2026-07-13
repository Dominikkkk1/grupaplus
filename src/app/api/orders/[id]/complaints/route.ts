import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { notifyComplaint } from "@/lib/email/notifications";

/**
 * POST /api/orders/[id]/complaints — nowe zgłoszenie incydentu
 */
export const POST = withAuth(["admin", "operator"], async (request, { supabase, user }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const raw = parsed.data as Record<string, unknown>;
  const type = raw.type as string;
  const orderItemId = (raw.orderItemId && raw.orderItemId !== "undefined") ? raw.orderItemId as string : null;
  const reason = raw.reason as string;
  const revertToStepId = (raw.revertToStepId && raw.revertToStepId !== "undefined") ? raw.revertToStepId as string : null;
  const revertBranchType = (raw.revertBranchType && raw.revertBranchType !== "undefined") ? raw.revertBranchType as string : null;
  const reprintQuantity = raw.reprintQuantity as number | null;
  const notes = raw.notes as string | undefined;
  console.log("[COMPLAINT] orderId=%s type=%s orderItemId=%s revertToStepId=%s revertBranchType=%s user=%s", id, type, orderItemId, revertToStepId, revertBranchType, user.id);

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "Powód zgłoszenia jest wymagany" }, { status: 400 });
  }

  if (reason.length > 5000) {
    return NextResponse.json({ error: "Powód zgłoszenia jest za długi (max 5000 znaków)" }, { status: 400 });
  }

  if (notes && notes.length > 5000) {
    return NextResponse.json({ error: "Uwagi są za długie (max 5000 znaków)" }, { status: 400 });
  }

  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      order_id: id,
      order_item_id: orderItemId || null,
      type: type || "internal",
      reason: reason.trim(),
      revert_to_step_id: revertToStepId || null,
      reprint_quantity: reprintQuantity || null,
      status: "open",
      reported_by: user.id,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[COMPLAINT] insert error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  console.log("[COMPLAINT] created id=%s", complaint.id);

  // Powiadomienie email (fire-and-forget)
  const { data: orderInfo } = await supabase
    .from("orders")
    .select("order_number, assigned_to")
    .eq("id", id)
    .single();

  notifyComplaint(supabase, {
    orderId: id,
    orderNumber: orderInfo?.order_number ?? null,
    type: type || "internal",
    reason: reason.trim(),
    reportedBy: user.id,
    assignedTo: (orderInfo?.assigned_to as string) ?? null,
  }).catch((err) => console.error("[COMPLAINT] notify error:", err));

  // Cofanie etapu przy reklamacji wewnetrznej
  if (type === "internal" && revertToStepId && orderItemId) {
    const { data: itemCheck } = await supabase
      .from("order_items")
      .select("id")
      .eq("id", orderItemId)
      .eq("order_id", id)
      .maybeSingle();
    if (!itemCheck) {
      return NextResponse.json({ error: "Pozycja nie należy do tego zamówienia" }, { status: 400 });
    }

    let targetStepQuery = supabase
      .from("order_item_progress")
      .select("step_order, branch_type")
      .eq("order_item_id", orderItemId)
      .eq("step_id", revertToStepId);

    if (revertBranchType) {
      targetStepQuery = targetStepQuery.eq("branch_type", revertBranchType);
    }

    const { data: targetSteps } = await targetStepQuery.limit(1);
    const targetStep = targetSteps?.[0];

    if (targetStep) {
      const bt = targetStep.branch_type ?? "common";
      console.log("[COMPLAINT] REVERT: item=%s from step_order=%d branch=%s", orderItemId, targetStep.step_order, bt);

      const resetData = { status: "pending" as const, completed_by: null, completed_at: null, machine_id: null, started_at: null, started_by: null };

      if (bt === "branch_a" || bt === "branch_b") {
        await supabase.from("order_item_progress").update(resetData)
          .eq("order_item_id", orderItemId).eq("branch_type", bt).gte("step_order", targetStep.step_order);
        await supabase.from("order_item_progress").update(resetData)
          .eq("order_item_id", orderItemId).eq("branch_type", "common").gte("step_order", 100);
      } else if (bt === "common" && targetStep.step_order >= 100) {
        await supabase.from("order_item_progress").update(resetData)
          .eq("order_item_id", orderItemId).eq("branch_type", "common").gte("step_order", targetStep.step_order);
      } else {
        await supabase.from("order_item_progress").update(resetData)
          .eq("order_item_id", orderItemId).gte("step_order", targetStep.step_order);
      }

      await supabase.from("order_items").update({ is_completed: false }).eq("id", orderItemId);

      const { data: revertedItem } = await supabase.from("order_items").select("order_id").eq("id", orderItemId).single();
      if (revertedItem) {
        const { data: currentOrder } = await supabase.from("orders").select("status").eq("id", revertedItem.order_id).single();
        if (currentOrder?.status === "ready") {
          console.log("[COMPLAINT] ORDER REVERT: %s ready → in_production", revertedItem.order_id);
          await supabase.from("orders").update({ status: "in_production" }).eq("id", revertedItem.order_id);
        }
      }
    }
  }

  return NextResponse.json({ id: complaint.id });
});

/**
 * GET /api/orders/[id]/complaints — lista zgloszen
 */
export const GET = withAuth(["admin", "operator"], async (_request, { supabase }, params) => {
  const id = params!.id;

  const { data: complaints } = await supabase
    .from("complaints")
    .select(
      "id, type, reason, status, reprint_quantity, notes, created_at, resolved_at, reported_by_user:users(full_name), revert_step:workflow_steps(name)"
    )
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json(complaints ?? []);
});
