import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { parseBody } from "@/lib/api/parse-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestOrder } from "@/lib/orders/ingest";
import type { OrderSource, OrderInput, OrderItemInput } from "@/lib/adapters/types";

/**
 * POST /api/orders — reczne tworzenie zamówienia (admin)
 */
export const POST = withAuth("admin", async (request, _ctx) => {
  const parsed = await parseBody(request);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as Record<string, unknown>;
  console.log("[ORDER CREATE] body.items=%j", body.items);

  if (!body.items || !(body.items as unknown[]).length) {
    return NextResponse.json(
      { error: "Zamówienie musi mieć przynajmniej jedną pozycję" },
      { status: 400 }
    );
  }

  try {
    const supabaseAdmin = createAdminClient();
    const result = await ingestOrder(supabaseAdmin, {
      source: (body.source as OrderSource) || "stacjonarne",
      externalId: (body.externalId as string) || `manual-${Date.now()}`,
      customerName: (body.customerName as string) || "Klient",
      customerEmail: body.customerEmail as string | undefined,
      customerPhone: body.customerPhone as string | undefined,
      companyName: body.companyName as string | undefined,
      nip: body.nip as string | undefined,
      shippingAddress: body.shippingAddress as string | undefined,
      shippingMethod: body.shippingMethod as string | undefined,
      paymentStatus: (body.paymentStatus as OrderInput["paymentStatus"]) || "pending",
      deadline: body.deadline ? new Date(body.deadline as string) : undefined,
      isPriority: (body.isPriority as boolean) ?? false,
      deliveryType: (body.deliveryType as OrderInput["deliveryType"]) ?? "shipping",
      items: body.items as OrderItemInput[],
      notes: body.notes as string | undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
