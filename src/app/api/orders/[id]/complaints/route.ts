import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyComplaint } from "@/lib/email/notifications";

/**
 * POST /api/orders/[id]/complaints — nowe zgłoszenie incydentu
 */
export async function POST(
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
  const { type, orderItemId, reason, revertToStepId, revertBranchType, reprintQuantity, notes } =
    body;
  console.log("[COMPLAINT] orderId=%s type=%s orderItemId=%s revertToStepId=%s revertBranchType=%s user=%s", id, type, orderItemId, revertToStepId, revertBranchType, user.id);

  if (!reason || !reason.trim()) {
    return NextResponse.json(
      { error: "Powód zgłoszenia jest wymagany" },
      { status: 400 }
    );
  }

  if (reason.length > 5000) {
    return NextResponse.json(
      { error: "Powód zgłoszenia jest za długi (max 5000 znaków)" },
      { status: 400 }
    );
  }

  if (notes && notes.length > 5000) {
    return NextResponse.json(
      { error: "Uwagi są za długie (max 5000 znaków)" },
      { status: 400 }
    );
  }

  // Utworz zgłoszenie
  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      order_id: id,
      order_item_id: (orderItemId && orderItemId !== "undefined") ? orderItemId : null,
      type: type || "internal",
      reason: reason.trim(),
      revert_to_step_id: (revertToStepId && revertToStepId !== "undefined") ? revertToStepId : null,
      reprint_quantity: reprintQuantity || null,
      status: "open",
      reported_by: user.id,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[COMPLAINT] insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Jesli zgłoszenie wewnetrzne z cofnieciem etapu — cofnij progress
  if (type === "internal" && revertToStepId && orderItemId) {
    // Znajdz step_order i branch_type tego etapu
    // Znajdz target step — jesli branch_type podany, uzyj go (precyzyjne dopasowanie)
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

      if (bt === "branch_a" || bt === "branch_b") {
        // Branch step: cofnij TYLKO ten branch + post-join common
        await supabase
          .from("order_item_progress")
          .update({ status: "pending", completed_by: null, completed_at: null, machine_id: null, started_at: null, started_by: null })
          .eq("order_item_id", orderItemId)
          .eq("branch_type", bt)
          .gte("step_order", targetStep.step_order);

        // Cofnij tez post-join common (bo branch sie zmienil)
        await supabase
          .from("order_item_progress")
          .update({ status: "pending", completed_by: null, completed_at: null, machine_id: null, started_at: null, started_by: null })
          .eq("order_item_id", orderItemId)
          .eq("branch_type", "common")
          .gte("step_order", 100);
      } else if (bt === "common" && targetStep.step_order >= 100) {
        // Post-join common: cofnij tylko post-join common od tego kroku
        await supabase
          .from("order_item_progress")
          .update({ status: "pending", completed_by: null, completed_at: null, machine_id: null, started_at: null, started_by: null })
          .eq("order_item_id", orderItemId)
          .eq("branch_type", "common")
          .gte("step_order", targetStep.step_order);
      } else {
        // Pre-fork common: cofnij WSZYSTKO (oba branche + post-join)
        await supabase
          .from("order_item_progress")
          .update({ status: "pending", completed_by: null, completed_at: null, machine_id: null, started_at: null, started_by: null })
          .eq("order_item_id", orderItemId)
          .gte("step_order", targetStep.step_order);
      }

      // Oznacz pozycje jako nieukonczona
      await supabase
        .from("order_items")
        .update({ is_completed: false })
        .eq("id", orderItemId);

      // Jesli zamówienie jest "ready" — cofnij do "in_production"
      const { data: revertedItem } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("id", orderItemId)
        .single();
      if (revertedItem) {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("status")
          .eq("id", revertedItem.order_id)
          .single();
        if (currentOrder?.status === "ready") {
          console.log("[COMPLAINT] ORDER REVERT: %s ready → in_production", revertedItem.order_id);
          await supabase
            .from("orders")
            .update({ status: "in_production" })
            .eq("id", revertedItem.order_id);
        }
      }
    }
  }

  return NextResponse.json({ id: complaint.id });
}

/**
 * GET /api/orders/[id]/complaints — lista zgloszen
 */
export async function GET(
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

  const { data: complaints } = await supabase
    .from("complaints")
    .select(
      "id, type, reason, status, reprint_quantity, notes, created_at, resolved_at, reported_by_user:users(full_name), revert_step:workflow_steps(name)"
    )
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json(complaints ?? []);
}
