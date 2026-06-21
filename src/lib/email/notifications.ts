import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./resend";
import { orderConfirmedEmail, orderShippedEmail, orderReadyEmail, complaintEmail } from "./templates";

/**
 * Wysyla powiadomienie email do klienta przy zmianie statusu zamówienia.
 * Wywolywane FIRE-AND-FORGET (nie blokuje response).
 *
 * Obslugiwane przejscia:
 * - → confirmed: "Zamówienie potwierdzone"
 * - → shipped: "Zamówienie wysłane" (z tracking number)
 */
export async function notifyOrderStatusChange(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: string
) {
  if (newStatus !== "confirmed" && newStatus !== "shipped" && newStatus !== "ready") return;

  // Pobierz dane zamówienia + kontakt + pozycje
  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_number, tracking_number, shipping_method, contact:contacts(full_name, email)"
    )
    .eq("id", orderId)
    .single();

  if (!order) {
    console.log("[NOTIFY] brak zamówienia %s", orderId);
    return;
  }

  const contact = order.contact as unknown as {
    full_name: string;
    email: string | null;
  } | null;

  if (!contact?.email) {
    console.log("[NOTIFY] brak email klienta dla zamówienia %s", order.order_number);
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

  if (newStatus === "ready") {
    const { subject, html } = orderReadyEmail({
      orderNumber: order.order_number,
      customerName: contact.full_name,
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

/**
 * Powiadomienie o nowym zgloszeniu reklamacji/incydentu.
 * Wysyla email do przypisanej osoby lub do wszystkich adminow.
 */
export async function notifyComplaint(
  supabase: SupabaseClient,
  opts: {
    orderId: string;
    orderNumber: string | null;
    type: string;
    reason: string;
    reportedBy: string;
    assignedTo: string | null;
  }
) {
  // Pobierz imie zglaszajacego
  const { data: reporter } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", opts.reportedBy)
    .maybeSingle();

  const reporterName = reporter?.full_name ?? "Operator";

  // Wyznacz odbiorcow: przypisana osoba lub wszyscy admini
  let recipients: string[] = [];

  if (opts.assignedTo) {
    const { data: assigned } = await supabase
      .from("users")
      .select("email")
      .eq("id", opts.assignedTo)
      .maybeSingle();
    if (assigned?.email) recipients.push(assigned.email);
  }

  if (recipients.length === 0) {
    const { data: admins } = await supabase
      .from("users")
      .select("email")
      .eq("role", "admin")
      .eq("is_active", true);
    recipients = (admins ?? []).map((a) => a.email).filter((e): e is string => !!e);
  }

  if (recipients.length === 0) {
    console.log("[NOTIFY] brak odbiorcow dla complaint orderId=%s", opts.orderId);
    return;
  }

  const { subject, html } = complaintEmail({
    orderNumber: opts.orderNumber ?? opts.orderId,
    type: opts.type,
    reason: opts.reason,
    reporterName,
  });

  for (const email of recipients) {
    await sendEmail({ to: email, subject, html });
  }
}
