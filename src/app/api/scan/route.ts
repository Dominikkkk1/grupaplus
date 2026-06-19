import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/scan — skanowanie QR na stacji roboczej
 *
 * Flow:
 * 1. Operator skanuje QR kod (zawiera order ID)
 * 2. System znajduje nastepny etap do wykonania
 * 3. "start" → oznacza etap jako in_progress (started_at + started_by)
 * 4. "complete" → oznacza etap jako completed (completed_at + completed_by)
 *
 * Auto-close: jesli operator ma inny krok in_progress → zamknij go
 *
 * Body: { progressId, action: "start" | "complete", force?: boolean }
 */
export async function POST(request: NextRequest) {
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
  const { progressId, action, force, machineId } = body;

  if (!progressId || !action) {
    return NextResponse.json(
      { error: "progressId i action sa wymagane" },
      { status: 400 }
    );
  }

  // Pobierz dane etapu
  const { data: progress } = await supabase
    .from("order_item_progress")
    .select("id, order_item_id, step_id, step_order, status, step:workflow_steps(name)")
    .eq("id", progressId)
    .single();

  if (!progress) {
    return NextResponse.json(
      { error: "Etap nie znaleziony" },
      { status: 404 }
    );
  }

  if (action === "start") {
    // Sprawdz czy poprzedni krok jest completed
    if (progress.step_order > 1) {
      const { data: prev } = await supabase
        .from("order_item_progress")
        .select("status")
        .eq("order_item_id", progress.order_item_id)
        .eq("step_order", progress.step_order - 1)
        .single();

      if (prev && prev.status !== "completed" && prev.status !== "skipped") {
        if (!force) {
          return NextResponse.json(
            {
              error: "Poprzedni etap nie jest ukonczony",
              requiresConfirmation: true,
              stepName: (progress.step as unknown as { name: string })?.name,
            },
            { status: 409 }
          );
        }
        // force=true → zamknij brakujacy etap
        await supabase
          .from("order_item_progress")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          })
          .eq("order_item_id", progress.order_item_id)
          .eq("step_order", progress.step_order - 1);
      }
    }

    // Auto-close: zamknij inne in_progress tego operatora
    const { data: openSteps } = await supabase
      .from("order_item_progress")
      .select("id")
      .eq("status", "in_progress")
      .eq("started_by", user.id)
      .neq("id", progressId);

    if (openSteps && openSteps.length > 0) {
      const ids = openSteps.map((s) => s.id);
      await supabase
        .from("order_item_progress")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .in("id", ids);
    }

    // Rozpocznij ten etap
    const startData: Record<string, unknown> = {
      status: "in_progress",
      started_at: new Date().toISOString(),
      started_by: user.id,
    };
    if (machineId) startData.machine_id = machineId;

    const { error } = await supabase
      .from("order_item_progress")
      .update(startData)
      .eq("id", progressId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action: "started",
      stepName: (progress.step as unknown as { name: string })?.name,
    });
  }

  if (action === "complete") {
    const completeData: Record<string, unknown> = {
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    };
    if (machineId) completeData.machine_id = machineId;

    const { error } = await supabase
      .from("order_item_progress")
      .update(completeData)
      .eq("id", progressId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sprawdz czy wszystkie etapy pozycji ukonczone
    const { data: allSteps } = await supabase
      .from("order_item_progress")
      .select("status")
      .eq("order_item_id", progress.order_item_id);

    const allDone = allSteps?.every(
      (s) => s.status === "completed" || s.status === "skipped"
    );

    if (allDone) {
      await supabase
        .from("order_items")
        .update({ is_completed: true })
        .eq("id", progress.order_item_id);
    }

    return NextResponse.json({
      ok: true,
      action: "completed",
      stepName: (progress.step as unknown as { name: string })?.name,
      allDone,
    });
  }

  return NextResponse.json({ error: "Nieznana akcja" }, { status: 400 });
}
