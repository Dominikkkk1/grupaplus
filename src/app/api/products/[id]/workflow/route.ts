import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/products/[id]/workflow — zastepuje caly workflow produktu
 * Body: { steps: [{ stepId: string, stepOrder: number }] }
 *
 * Atomowa operacja: usun stare → wstaw nowe.
 * Dziala jak "zapisz obecny stan" — nie trzeba sledzic co dodane/usuniete.
 */
export async function PUT(
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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const steps: { stepId: string; stepOrder: number; branchType?: string }[] = body.steps ?? [];

  // Usuń stare przypisania
  const { error: deleteError } = await supabase
    .from("product_workflow")
    .delete()
    .eq("product_id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Wstaw nowe (jesli sa)
  if (steps.length > 0) {
    const rows = steps.map((s) => ({
      product_id: id,
      step_id: s.stepId,
      step_order: s.stepOrder,
      branch_type: s.branchType || "common",
      is_required: true,
    }));

    const { error: insertError } = await supabase
      .from("product_workflow")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
