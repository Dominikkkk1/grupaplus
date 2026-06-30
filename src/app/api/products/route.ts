import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/products — tworzenie nowego produktu
 * Body: { name, sku?, category?, basPrice?, description? }
 */
export async function POST(request: NextRequest) {
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
  const { name, sku, category, basePrice, description, leadTimeDays } = body;

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Nazwa produktu jest wymagana" },
      { status: 400 }
    );
  }

  if (sku) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("sku", sku.trim())
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
      name: name.trim(),
      sku: sku?.trim() || null,
      category: category || "maly_format",
      base_price: basePrice ?? null,
      description: description?.trim() || null,
      lead_time_days: leadTimeDays ?? null,
    })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(product);
}
