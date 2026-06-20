import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWooCommerceOrder, type WooOrderPayload } from "@/lib/adapters/woocommerce";
import { ingestOrder } from "@/lib/orders/ingest";

/**
 * POST /api/webhooks/woocommerce
 *
 * Odbiera webhooki z WooCommerce (event: order.completed).
 * Flow:
 * 1. Zapisz surowy payload do webhook_events (ZAWSZE PIERWSZY KROK)
 * 2. Waliduj podpis HMAC
 * 3. Adapter: WooCommerce payload → OrderInput
 * 4. Ingest: utworz order + order_items + progress
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  // Odczytaj body jako tekst (potrzebne do HMAC)
  const rawBody = await request.text();
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 1. ZAWSZE zapisz surowy payload PRZED przetworzeniem
  const topic = request.headers.get("x-wc-webhook-topic") ?? "unknown";
  console.log("[WEBHOOK WOO] topic=%s payload.id=%s", topic, payload.id);
  const { data: webhookEvent } = await supabase
    .from("webhook_events")
    .insert({
      source: "woocommerce",
      event_type: topic,
      payload,
    })
    .select("id")
    .maybeSingle();

  // WooCommerce wysyla ping przy tworzeniu webhooka — odpowiedz 200
  if (topic === "ping" || !payload.id) {
    return NextResponse.json({ ok: true, message: "pong" });
  }

  // 2. Waliduj podpis HMAC
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get("x-wc-webhook-signature") ?? "";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("[WEBHOOK WOO] HMAC mismatch — invalid signature");
      // Zapisz blad
      if (webhookEvent) {
        await supabase
          .from("webhook_events")
          .update({ error: "Invalid HMAC signature" })
          .eq("id", webhookEvent.id);
      }

      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  }

  // 3. Przetwarzaj tylko zamowienia
  if (!topic.startsWith("order.")) {
    return NextResponse.json({ ok: true, message: "skipped" });
  }

  try {
    const orderInput = parseWooCommerceOrder(payload as unknown as WooOrderPayload);
    console.log("[WEBHOOK WOO] parsed: customer=%s items=%d source=%s", orderInput.customerName, orderInput.items.length, orderInput.source);
    const result = await ingestOrder(supabase, orderInput);

    // Oznacz webhook jako przetworzony
    if (webhookEvent) {
      await supabase
        .from("webhook_events")
        .update({ processed: true })
        .eq("id", webhookEvent.id);
    }

    console.log("[WEBHOOK WOO] success: %s (%s)", result.orderNumber, result.orderId);
    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[WEBHOOK WOO] error:", message);

    // Zapisz blad w webhook_events
    if (webhookEvent) {
      await supabase
        .from("webhook_events")
        .update({ error: message })
        .eq("id", webhookEvent.id);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
