import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/orders/[id]/complaints/[complaintId] — zmiana statusu zgłoszenia
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; complaintId: string }> }
) {
  const { id, complaintId } = await params;
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, notes } = await request.json();

  const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "rejected"];
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Nieprawidłowy status" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { status };
  if (notes !== undefined) updateData.notes = notes;
  if (status === "resolved") updateData.resolved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("complaints")
    .update(updateData)
    .eq("id", complaintId)
    .eq("order_id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[COMPLAINT PATCH] error:", error.message);
    return NextResponse.json({ error: "Błąd aktualizacji" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Zgłoszenie nie znalezione" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
