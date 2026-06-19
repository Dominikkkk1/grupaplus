import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/orders/[id]/complaints/[complaintId] — zmiana statusu zgloszenia
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; complaintId: string }> }
) {
  const { complaintId } = await params;
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

  const updateData: Record<string, unknown> = { status };
  if (notes !== undefined) updateData.notes = notes;
  if (status === "resolved") updateData.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from("complaints")
    .update(updateData)
    .eq("id", complaintId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
