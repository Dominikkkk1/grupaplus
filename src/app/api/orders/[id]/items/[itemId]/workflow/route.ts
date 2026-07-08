import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/orders/[id]/items/[itemId]/workflow
 * Ręczne ustawianie marszruty produkcyjnej dla pozycji bez workflow.
 * Body: { steps: [{ stepId, stepOrder }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — tylko admin" }, { status: 403 });
  }

  const body = await request.json();
  const { steps } = body;

  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json(
      { error: "Wymagany przynajmniej jeden etap" },
      { status: 400 }
    );
  }

  // Sprawdz czy item nalezy do tego zamowienia
  const { data: item } = await supabase
    .from("order_items")
    .select("id, order_id")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (!item) {
    return NextResponse.json(
      { error: "Pozycja nie znaleziona w tym zamówieniu" },
      { status: 404 }
    );
  }

  // Sprawdz czy item nie ma juz rozpoczetych/ukonczonych krokow
  const { data: existingNonPending } = await supabase
    .from("order_item_progress")
    .select("id")
    .eq("order_item_id", itemId)
    .in("status", ["in_progress", "completed"])
    .limit(1);

  if (existingNonPending && existingNonPending.length > 0) {
    return NextResponse.json(
      { error: "Nie można zmienić marszruty — produkcja już rozpoczęta" },
      { status: 409 }
    );
  }

  // Usuń istniejace pending progress rows
  const { error: deleteError } = await supabase
    .from("order_item_progress")
    .delete()
    .eq("order_item_id", itemId)
    .eq("status", "pending");

  if (deleteError) {
    console.error("[ITEM WORKFLOW] delete error:", deleteError.message);
    console.error("[API] DB error:", deleteError.message); return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  // Wstaw nowe progress rows
  const progressRows = steps.map((s: { stepId: string; stepOrder: number }) => ({
    order_item_id: itemId,
    step_id: s.stepId,
    step_order: s.stepOrder,
    status: "pending",
  }));

  const { error: insertError } = await supabase
    .from("order_item_progress")
    .insert(progressRows);

  if (insertError) {
    console.error("[ITEM WORKFLOW] insert error:", insertError.message);
    console.error("[API] DB error:", insertError.message); return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  console.log("[ITEM WORKFLOW] orderId=%s itemId=%s steps=%d", orderId, itemId, steps.length);
  return NextResponse.json({ ok: true, stepsCount: steps.length });
}
