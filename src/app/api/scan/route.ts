import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderStatusChange } from "@/lib/email/notifications";

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
    console.log("[SCAN] 401 — brak sesji");
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
    console.log("[SCAN] 403 — rola:", profile?.role, "user:", user.id);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { progressId, action, force, machineId } = body;
  console.log("[SCAN] action=%s progressId=%s force=%s machineId=%s user=%s", action, progressId, force, machineId, user.id);

  if (!progressId || !action) {
    return NextResponse.json(
      { error: "progressId i action sa wymagane" },
      { status: 400 }
    );
  }

  // Pobierz dane etapu
  const { data: progress } = await supabase
    .from("order_item_progress")
    .select("id, order_item_id, step_id, step_order, status, branch_type, step:workflow_steps(name)")
    .eq("id", progressId)
    .single();

  if (!progress) {
    console.log("[SCAN] 404 — etap nie znaleziony, progressId=%s", progressId);
    return NextResponse.json(
      { error: "Etap nie znaleziony" },
      { status: 404 }
    );
  }

  const stepName = (progress.step as unknown as { name: string })?.name;
  const branchType = (progress as unknown as { branch_type: string }).branch_type ?? "common";
  console.log("[SCAN] etap: %s (order %d, branch=%s), krok: %s, obecny status: %s", stepName, progress.step_order, branchType, progressId, progress.status);

  if (action === "start") {
    // Blokada: nie mozna startowac krokow jesli zamowienie oczekuje na akceptacje projektu
    const { data: startCheckItem } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("id", progress.order_item_id)
      .single();
    if (startCheckItem) {
      const { data: startCheckOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", startCheckItem.order_id)
        .single();
      if (startCheckOrder?.status === "awaiting_approval") {
        console.log("[SCAN] BLOCKED: order %s awaiting_approval — nie mozna startowac kolejnych krokow", startCheckItem.order_id);
        return NextResponse.json(
          { error: "Zamówienie oczekuje na akceptację projektu. Nie można rozpocząć kolejnych etapów." },
          { status: 409 }
        );
      }
    }

    // Sprawdz czy poprzedni krok jest completed (branch-aware)
    if (branchType === "common") {
      // Common step: sprawdz czy istnieja branche (post-join)
      const { data: branchSteps } = await supabase
        .from("order_item_progress")
        .select("status, branch_type")
        .eq("order_item_id", progress.order_item_id)
        .in("branch_type", ["branch_a", "branch_b"]);

      const hasBranches = branchSteps && branchSteps.length > 0;

      if (hasBranches && progress.step_order >= 100) {
        // Post-join common: czekaj az OBA branche beda done
        const branchADone = branchSteps.filter((s) => s.branch_type === "branch_a").every((s) => s.status === "completed" || s.status === "skipped");
        const branchBDone = branchSteps.filter((s) => s.branch_type === "branch_b").every((s) => s.status === "completed" || s.status === "skipped");

        if (!branchADone || !branchBDone) {
          console.log("[SCAN] JOIN BLOCKED: branchA=%s branchB=%s", branchADone, branchBDone);
          return NextResponse.json(
            { error: "Nie można rozpocząć — czekam na zakończenie obu branchy (okładka + wkład)" },
            { status: 409 }
          );
        }

        // Sprawdz tez poprzedni post-join common (step_order - 1 w common)
        if (progress.step_order > 101) {
          const { data: prevPostJoin } = await supabase
            .from("order_item_progress")
            .select("status")
            .eq("order_item_id", progress.order_item_id)
            .eq("branch_type", "common")
            .eq("step_order", progress.step_order - 1)
            .maybeSingle();

          if (prevPostJoin && prevPostJoin.status !== "completed" && prevPostJoin.status !== "skipped") {
            if (!force) {
              return NextResponse.json({ error: "Poprzedni etap nie jest ukończony", requiresConfirmation: true, stepName }, { status: 409 });
            }
            await supabase.from("order_item_progress").update({ status: "skipped" })
              .eq("order_item_id", progress.order_item_id).eq("branch_type", "common").eq("step_order", progress.step_order - 1);
          }
        }
      } else if (progress.step_order > 1) {
        // Pre-fork common: standardowa sekwencyjna walidacja
        const { data: prev } = await supabase
          .from("order_item_progress")
          .select("status")
          .eq("order_item_id", progress.order_item_id)
          .eq("branch_type", "common")
          .eq("step_order", progress.step_order - 1)
          .maybeSingle();

        if (prev && prev.status !== "completed" && prev.status !== "skipped") {
          if (!force) {
            return NextResponse.json({ error: "Poprzedni etap nie jest ukończony", requiresConfirmation: true, stepName }, { status: 409 });
          }
          await supabase.from("order_item_progress").update({ status: "skipped" })
            .eq("order_item_id", progress.order_item_id).eq("branch_type", "common").eq("step_order", progress.step_order - 1);
        }
      }
    } else {
      // Branch step (branch_a lub branch_b)
      if (progress.step_order === 1) {
        // Pierwszy krok w branchu: sprawdz ostatni pre-fork common
        const { data: preForkSteps } = await supabase
          .from("order_item_progress")
          .select("status, step_order")
          .eq("order_item_id", progress.order_item_id)
          .eq("branch_type", "common")
          .lt("step_order", 100)
          .order("step_order", { ascending: false })
          .limit(1);

        const lastPreFork = preForkSteps?.[0];
        if (lastPreFork && lastPreFork.status !== "completed" && lastPreFork.status !== "skipped") {
          if (!force) {
            return NextResponse.json({ error: "Poprzedni wspólny etap nie jest ukończony", requiresConfirmation: true, stepName }, { status: 409 });
          }
        }
      } else {
        // Kolejny krok w branchu: sprawdz step_order-1 w TYM SAMYM branchu
        const { data: prevBranch } = await supabase
          .from("order_item_progress")
          .select("status")
          .eq("order_item_id", progress.order_item_id)
          .eq("branch_type", branchType)
          .eq("step_order", progress.step_order - 1)
          .maybeSingle();

        if (prevBranch && prevBranch.status !== "completed" && prevBranch.status !== "skipped") {
          if (!force) {
            return NextResponse.json({ error: "Poprzedni etap nie jest ukończony", requiresConfirmation: true, stepName }, { status: 409 });
          }
          await supabase.from("order_item_progress").update({ status: "skipped" })
            .eq("order_item_id", progress.order_item_id).eq("branch_type", branchType).eq("step_order", progress.step_order - 1);
        }
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
      // Wroc do pending — operator musi swiadomie zakończyc etap, nie zamykamy automatycznie
      const ids = openSteps.map((s) => s.id);
      console.log("[SCAN] AUTO-CLOSE: %d etapow in_progress tego operatora wracaja do pending, ids=%j", ids.length, ids);
      await supabase
        .from("order_item_progress")
        .update({
          status: "pending",
          started_at: null,
          started_by: null,
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
      console.error("[SCAN] START error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-advance: jesli zamówienie jest "confirmed", przejdz do "in_production"
    const { data: scannedItem } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("id", progress.order_item_id)
      .single();
    if (scannedItem) {
      const { data: scannedOrder } = await supabase
        .from("orders")
        .select("status")
        .eq("id", scannedItem.order_id)
        .single();
      if (scannedOrder?.status === "confirmed") {
        console.log("[SCAN] AUTO-ADVANCE: order %s confirmed → in_production", scannedItem.order_id);
        await supabase
          .from("orders")
          .update({ status: "in_production" })
          .eq("id", scannedItem.order_id);
      }
      // awaiting_approval — blokada jest na poczatku action=start, tu nie robimy nic
    }

    console.log("[SCAN] STARTED: %s (progressId=%s, machine=%s)", stepName, progressId, machineId || "brak");
    return NextResponse.json({
      ok: true,
      action: "started",
      stepName,
    });
  }

  if (action === "complete") {
    console.log("[SCAN] COMPLETE: %s (progressId=%s)", stepName, progressId);
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

    // Auto-awaiting_approval: po zakonczeniu kroku "Projektowanie"
    if (stepName === "Projektowanie") {
      const { data: projItem } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("id", progress.order_item_id)
        .single();
      if (projItem) {
        const { data: projOrder } = await supabase
          .from("orders")
          .select("status")
          .eq("id", projItem.order_id)
          .single();
        // Tylko jesli zamowienie jest confirmed lub in_production (nie juz awaiting_approval)
        if (projOrder && ["confirmed", "in_production"].includes(projOrder.status)) {
          console.log("[SCAN] AUTO: Projektowanie zakonczone → order %s → awaiting_approval", projItem.order_id);
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

    // Sprawdz czy wszystkie etapy pozycji ukończone
    const { data: allSteps } = await supabase
      .from("order_item_progress")
      .select("status")
      .eq("order_item_id", progress.order_item_id);

    const allDone = allSteps?.every(
      (s) => s.status === "completed" || s.status === "skipped"
    );

    if (allDone) {
      console.log("[SCAN] ALL DONE — pozycja %s ukonczona", progress.order_item_id);
      await supabase
        .from("order_items")
        .update({ is_completed: true })
        .eq("id", progress.order_item_id);

      // Sprawdz czy WSZYSTKIE pozycje zamowienia sa ukonczone → auto-ready
      const { data: itemRow } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("id", progress.order_item_id)
        .single();

      if (itemRow) {
        const { data: allItems } = await supabase
          .from("order_items")
          .select("is_completed")
          .eq("order_id", itemRow.order_id);

        const orderReady = allItems?.every((i) => i.is_completed);
        if (orderReady) {
          console.log("[SCAN] ORDER READY — zamowienie %s gotowe", itemRow.order_id);
          await supabase
            .from("orders")
            .update({ status: "ready" })
            .eq("id", itemRow.order_id)
            .in("status", ["in_production"]);

          // Email powiadomienie o gotowosci (fire-and-forget)
          notifyOrderStatusChange(supabase, itemRow.order_id, "ready").catch(
            (err) => console.error("[SCAN] notify ready error:", err)
          );
        }
      }
    }

    // Pobierz info o nastepnym kroku (branch-aware)
    let nextStep: { name: string; group: string | null } | null = null;
    if (!allDone) {
      // Nastepny krok w tym samym branchu
      const { data: next } = await supabase
        .from("order_item_progress")
        .select("step:workflow_steps(name, machine_group:machine_groups(name))")
        .eq("order_item_id", progress.order_item_id)
        .eq("branch_type", branchType)
        .eq("step_order", progress.step_order + 1)
        .maybeSingle();

      let stepData = next?.step as unknown as { name: string; machine_group: { name: string } | null } | null;

      // Jesli nie ma nastepnego w tym branchu — szukaj post-join common (step_order >= 100)
      if (!stepData && branchType !== "common") {
        const { data: postJoin } = await supabase
          .from("order_item_progress")
          .select("step:workflow_steps(name, machine_group:machine_groups(name))")
          .eq("order_item_id", progress.order_item_id)
          .eq("branch_type", "common")
          .gte("step_order", 100)
          .order("step_order")
          .limit(1);
        stepData = (postJoin?.[0]?.step as unknown as { name: string; machine_group: { name: string } | null } | null) ?? null;
      }

      if (stepData) {
        nextStep = {
          name: stepData.name,
          group: stepData.machine_group?.name ?? null,
        };
      }
    }

    console.log("[SCAN] COMPLETED: %s, allDone=%s, nextStep=%j", stepName, allDone, nextStep);
    return NextResponse.json({
      ok: true,
      action: "completed",
      stepName,
      allDone,
      nextStep,
    });
  }

  return NextResponse.json({ error: "Nieznana akcja" }, { status: 400 });
}
