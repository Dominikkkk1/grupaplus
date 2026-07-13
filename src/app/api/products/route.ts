import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";

/**
 * POST /api/products — tworzenie nowego produktu
 */
export const POST = withAuth("admin", async (request, { supabase }) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const { name, sku, category, basePrice, description, leadTimeDays } = parsed.data as Record<string, unknown>;

  if (!name || !(name as string).trim()) {
    return NextResponse.json(
      { error: "Nazwa produktu jest wymagana" },
      { status: 400 }
    );
  }

  if (sku) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("sku", (sku as string).trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Produkt z tym SKU juz istnieje" },
        { status: 409 }
      );
    }
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: (name as string).trim(),
      sku: sku ? (sku as string).trim() : null,
      category: (category as string) || "maly_format",
      base_price: (basePrice as number) ?? null,
      description: description ? (description as string).trim() : null,
      lead_time_days: leadTimeDays && (leadTimeDays as number) > 0 ? (leadTimeDays as number) : null,
    })
    .select("id, name")
    .single();

  if (error) {
    console.error("[PRODUCTS] DB error:", error.message);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }

  return NextResponse.json(product);
});
