import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * PUT /api/products/[id]/workflow — zastepuje caly workflow produktu
 */
export const PUT = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const steps: { stepId: string; stepOrder: number; branchType?: string }[] =
    (body.steps as { stepId: string; stepOrder: number; branchType?: string }[]) ?? [];

  if (steps.length > 50) {
    return NextResponse.json({ error: "Maksymalnie 50 kroków workflow" }, { status: 400 });
  }

  const { error: deleteError } = await supabase.from("product_workflow").delete().eq("product_id", id);
  if (deleteError) {
    console.error("[PRODUCT_WORKFLOW] delete error:", deleteError.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  if (steps.length > 0) {
    const rows = steps.map((s) => ({
      product_id: id,
      step_id: s.stepId,
      step_order: s.stepOrder,
      branch_type: s.branchType || "common",
      is_required: true,
    }));

    const { error: insertError } = await supabase.from("product_workflow").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
});
