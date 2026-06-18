import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderInput } from "@/lib/adapters/types";

/**
 * Tworzy zamowienie z ujednoliconego OrderInput.
 * Uzywany przez webhook (WooCommerce/BaseLinker) i formularz reczny.
 *
 * Flow:
 * 1. Upsert kontakt (po email lub allegro_login)
 * 2. Upsert firma (po NIP, jesli podano)
 * 3. Sprawdz idempotentnosc (external_id)
 * 4. Utworz order + order_items
 * 5. Trigger DB automatycznie tworzy order_item_progress z product_workflow
 */
export async function ingestOrder(
  supabase: SupabaseClient,
  input: OrderInput
): Promise<{ orderId: string; orderNumber: string }> {
  // 1. Idempotentnosc — sprawdz czy juz istnieje
  if (input.externalId) {
    const { data: existing } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("source", input.source)
      .eq("external_id", input.externalId)
      .maybeSingle();

    if (existing) {
      return { orderId: existing.id, orderNumber: existing.order_number };
    }
  }

  // 2. Upsert firma (po NIP)
  let companyId: string | null = null;
  if (input.nip) {
    const { data: company } = await supabase
      .from("companies")
      .upsert(
        { nip: input.nip, name: input.companyName || input.customerName },
        { onConflict: "nip" }
      )
      .select("id")
      .single();
    companyId = company?.id ?? null;
  }

  // 3. Upsert kontakt (po email lub allegro_login)
  let contactId: string | null = null;
  if (input.customerEmail || input.allegroLogin) {
    // Szukaj istniejacego kontaktu
    let query = supabase.from("contacts").select("id");
    if (input.allegroLogin) {
      query = query.eq("allegro_login", input.allegroLogin);
    } else if (input.customerEmail) {
      query = query.eq("email", input.customerEmail);
    }
    const { data: existingContact } = await query.maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      // Upsert: jesli email juz istnieje (race condition), zwroc istniejacy
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          full_name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone,
          allegro_login: input.allegroLogin,
          company_id: companyId,
        })
        .select("id")
        .single();

      if (contactError && input.customerEmail) {
        // UNIQUE conflict — pobierz istniejacy kontakt
        const { data: fallback } = await supabase
          .from("contacts")
          .select("id")
          .eq("email", input.customerEmail)
          .single();
        contactId = fallback?.id ?? null;
      } else {
        contactId = newContact?.id ?? null;
      }
    }
  }

  // 4. Matchuj SKU z produktami
  const skus = input.items
    .map((i) => i.productSku)
    .filter((s): s is string => !!s);

  const productMap = new Map<string, string>();
  if (skus.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, sku")
      .in("sku", skus);
    products?.forEach((p) => {
      if (p.sku) productMap.set(p.sku, p.id);
    });
  }

  // 5. Utworz zamowienie (order_number generuje sie automatycznie przez trigger)
  const totalPrice = input.items.reduce(
    (sum, i) => sum + (i.unitPrice ?? 0) * i.quantity,
    0
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: "", // trigger auto-generuje
      source: input.source,
      external_id: input.externalId || null,
      company_id: companyId,
      contact_id: contactId,
      status: "new",
      payment_status: input.paymentStatus,
      deadline: input.deadline?.toISOString() ?? null,
      shipping_method: input.shippingMethod ?? null,
      notes: input.notes ?? null,
      total_price: totalPrice > 0 ? totalPrice : null,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    throw new Error(`Blad tworzenia zamowienia: ${orderError?.message}`);
  }

  // 6. Utworz pozycje (trigger DB automatycznie tworzy progress z product_workflow)
  const orderItems = input.items.map((item) => ({
    order_id: order.id,
    product_id: item.productSku ? productMap.get(item.productSku) ?? null : null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice ?? null,
    specifications: item.specifications ?? {},
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    throw new Error(`Blad tworzenia pozycji: ${itemsError.message}`);
  }

  return { orderId: order.id, orderNumber: order.order_number };
}
