import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/orders/[id]/complaints — nowe zgloszenie incydentu
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
  const { type, orderItemId, reason, revertToStepId, reprintQuantity, notes } =
    body;

  if (!reason || !reason.trim()) {
    return NextResponse.json(
      { error: "Powod zgloszenia jest wymagany" },
      { status: 400 }
    );
  }

  // Utworz zgloszenie
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Jesli zgloszenie wewnetrzne z cofnieciem etapu — cofnij progress
  if (type === "internal" && revertToStepId && orderItemId) {
    // Znajdz step_order tego etapu
    const { data: targetStep } = await supabase
      .from("order_item_progress")
      .select("step_order")
      .eq("order_item_id", orderItemId)
      .eq("step_id", revertToStepId)
      .maybeSingle();

    if (targetStep) {
      // Cofnij wszystkie etapy od tego w gore do pending
      await supabase
        .from("order_item_progress")
        .update({
          status: "pending",
          completed_by: null,
          completed_at: null,
          machine_id: null,
        })
        .eq("order_item_id", orderItemId)
        .gte("step_order", targetStep.step_order);

      // Oznacz pozycje jako nieukonczona
      await supabase
        .from("order_items")
        .update({ is_completed: false })
        .eq("id", orderItemId);
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
