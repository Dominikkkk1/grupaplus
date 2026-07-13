import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

export const PATCH = withAuth("admin", async (request, { supabase }, params) => {
  const id = params!.id;
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = (body.name as string).trim();
  if (body.sku !== undefined) updateData.sku = body.sku ? (body.sku as string).trim() : null;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.basePrice !== undefined) updateData.base_price = body.basePrice;
  if (body.description !== undefined) updateData.description = body.description ? (body.description as string).trim() : null;
  if (body.isActive !== undefined) updateData.is_active = body.isActive;
  if (body.leadTimeDays !== undefined) updateData.lead_time_days = body.leadTimeDays && (body.leadTimeDays as number) > 0 ? body.leadTimeDays : null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
  }

  if (updateData.sku) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("sku", updateData.sku as string)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Produkt z tym SKU juz istnieje" }, { status: 409 });
    }
  }

  const { error } = await supabase.from("products").update(updateData).eq("id", id);

  if (error) {
    console.error("[PRODUCTS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth("admin", async (_request, { supabase }, params) => {
  const id = params!.id;

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error("[PRODUCTS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
