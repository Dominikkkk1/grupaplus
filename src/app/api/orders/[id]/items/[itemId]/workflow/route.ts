import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * PUT /api/orders/[id]/items/[itemId]/workflow — ręczna marszruta
 */
export const PUT = withAuth("admin", async (request, { supabase }, params) => {
  const { id: orderId, itemId } = params as unknown as { id: string; itemId: string };
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const steps = body.steps as { stepId: string; stepOrder: number }[] | undefined;

  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: "Wymagany przynajmniej jeden etap" }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("order_items").select("id, order_id").eq("id", itemId).eq("order_id", orderId).maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Pozycja nie znaleziona w tym zamówieniu" }, { status: 404 });
  }

  const { data: existingNonPending } = await supabase
    .from("order_item_progress").select("id").eq("order_item_id", itemId).in("status", ["in_progress", "completed"]).limit(1);

  if (existingNonPending && existingNonPending.length > 0) {
    return NextResponse.json({ error: "Nie można zmienić marszruty — produkcja już rozpoczęta" }, { status: 409 });
  }

  const { error: deleteError } = await supabase
    .from("order_item_progress").delete().eq("order_item_id", itemId).eq("status", "pending");

  if (deleteError) {
    console.error("[ITEM WORKFLOW] delete error:", deleteError.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  const progressRows = steps.map((s) => ({
    order_item_id: itemId,
    step_id: s.stepId,
    step_order: s.stepOrder,
    status: "pending" as const,
  }));

  const { error: insertError } = await supabase.from("order_item_progress").insert(progressRows);
  if (insertError) {
    console.error("[ITEM WORKFLOW] insert error:", insertError.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  console.log("[ITEM WORKFLOW] orderId=%s itemId=%s steps=%d", orderId, itemId, steps.length);
  return NextResponse.json({ ok: true, stepsCount: steps.length });
});
