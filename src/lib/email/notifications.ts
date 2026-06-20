import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./resend";
import { orderConfirmedEmail, orderShippedEmail } from "./templates";

/**
 * Wysyla powiadomienie email do klienta przy zmianie statusu zamowienia.
 * Wywolywane FIRE-AND-FORGET (nie blokuje response).
 *
 * Obslugiwane przejscia:
 * - → confirmed: "Zamowienie potwierdzone"
 * - → shipped: "Zamowienie wyslane" (z tracking number)
 */
export async function notifyOrderStatusChange(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: string
) {
  if (newStatus !== "confirmed" && newStatus !== "shipped") return;

  // Pobierz dane zamowienia + kontakt + pozycje
  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_number, tracking_number, shipping_method, contact:contacts(full_name, email)"
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    console.log("[NOTIFY] brak zamowienia %s", orderId);
    return;
  }

  const contact = order.contact as unknown as {
    full_name: string;
    email: string | null;
  } | null;

  if (!contact?.email) {
    console.log("[NOTIFY] brak email klienta dla zamowienia %s", order.order_number);
    return;
  }

  if (newStatus === "confirmed") {
    // Pobierz pozycje
    const { data: items } = await supabase
      .from("order_items")
      .select("description, quantity")
      .eq("order_id", orderId);

    const { subject, html } = orderConfirmedEmail({
      orderNumber: order.order_number,
      customerName: contact.full_name,
      items: (items ?? []).map((i) => ({
        description: i.description,
        quantity: i.quantity,
      })),
    });

    await sendEmail({ to: contact.email, subject, html });
  }

  if (newStatus === "shipped") {
    const { subject, html } = orderShippedEmail({
      orderNumber: order.order_number,
      customerName: contact.full_name,
      trackingNumber: order.tracking_number as string | null,
      shippingMethod: order.shipping_method as string | null,
    });

    await sendEmail({ to: contact.email, subject, html });
  }
}
