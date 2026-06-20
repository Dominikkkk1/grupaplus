import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestOrder } from "@/lib/orders/ingest";
import type { OrderSource } from "@/lib/adapters/types";

/**
 * POST /api/orders — reczne tworzenie zamówienia (admin)
 */
export async function POST(request: NextRequest) {
  // Sprawdz auth
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sprawdz role (tylko admin moze tworzyc reczne zamówienia)
  const { data: profile } = await supabaseAuth
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  console.log("[ORDER CREATE] body.items=%j", body.items);

  // Walidacja
  if (!body.items || body.items.length === 0) {
    return NextResponse.json(
      { error: "Zamówienie musi miec przynajmniej jedna pozycje" },
      { status: 400 }
    );
  }

  try {
    const supabaseAdmin = createAdminClient();
    const result = await ingestOrder(supabaseAdmin, {
      source: (body.source as OrderSource) || "stacjonarne",
      externalId: body.externalId || `manual-${Date.now()}`,
      customerName: body.customerName || "Klient",
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      companyName: body.companyName,
      nip: body.nip,
      shippingAddress: body.shippingAddress,
      shippingMethod: body.shippingMethod,
      paymentStatus: body.paymentStatus || "pending",
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      items: body.items,
      notes: body.notes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
