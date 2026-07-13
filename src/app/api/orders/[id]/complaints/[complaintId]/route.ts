import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * PATCH /api/orders/[id]/complaints/[complaintId] — zmiana statusu zgłoszenia
 */
export const PATCH = withAuth("admin", async (request, { supabase }, params) => {
  const { id, complaintId } = params as unknown as { id: string; complaintId: string };
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { status, notes } = parsed.data as Record<string, unknown>;

  const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "rejected"];
  if (!status || !ALLOWED_STATUSES.includes(status as string)) {
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
});
