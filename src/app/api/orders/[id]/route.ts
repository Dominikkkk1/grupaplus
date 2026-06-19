import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["in_production", "new", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: ["new"],
};

/**
 * PATCH /api/orders/[id] — zmiana statusu i/lub przypisania operatora
 * Body: { status?, assignedTo? }
 */
export async function PATCH(
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
  const updateData: Record<string, unknown> = {};

  // Zmiana statusu — walidacja przejsc
  if (body.status) {
    const { data: order } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json(
        { error: "Zamowienie nie znalezione" },
        { status: 404 }
      );
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Nie mozna zmienic statusu z "${order.status}" na "${body.status}"`,
        },
        { status: 400 }
      );
    }

    updateData.status = body.status;
  }

  // Przypisanie operatora
  if (body.assignedTo !== undefined) {
    updateData.assigned_to = body.assignedTo || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "Brak danych do aktualizacji" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
