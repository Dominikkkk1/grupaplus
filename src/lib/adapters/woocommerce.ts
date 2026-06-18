import type { OrderInput, OrderItemInput } from "./types";

/**
 * Mapuje payload webhooka WooCommerce (event: order.completed / order.paid)
 * na ujednolicony OrderInput.
 *
 * Dokumentacja WooCommerce webhook payload:
 * https://woocommerce.github.io/woocommerce-rest-api-docs/#order-properties
 */

interface WooLineItem {
  id: number;
  name: string;
  product_id: number;
  sku: string;
  quantity: number;
  price: string;
  meta_data?: { key: string; value: string }[];
}

interface WooBilling {
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
}

interface WooShipping {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  city: string;
  postcode: string;
  country: string;
}

export interface WooOrderPayload {
  id: number;
  number: string;
  status: string;
  date_created: string;
  billing: WooBilling;
  shipping: WooShipping;
  line_items: WooLineItem[];
  shipping_lines: { method_title: string }[];
  payment_method_title: string;
  total: string;
  customer_note: string;
  meta_data?: { key: string; value: string }[];
}

export function parseWooCommerceOrder(payload: WooOrderPayload): OrderInput {
  const billing = payload.billing;
  const shipping = payload.shipping;

  const customerName = [billing.first_name, billing.last_name]
    .filter(Boolean)
    .join(" ");

  const shippingAddress = [
    shipping.address_1,
    shipping.address_2,
    shipping.postcode,
    shipping.city,
    shipping.country,
  ]
    .filter(Boolean)
    .join(", ");

  const items: OrderItemInput[] = payload.line_items.map((item) => {
    const parsed = parseFloat(item.price);
    return {
      externalId: String(item.id),
      productSku: item.sku || undefined,
      description: item.name,
      quantity: item.quantity,
      unitPrice: isNaN(parsed) ? undefined : parsed,
    };
  });

  const shippingMethod =
    payload.shipping_lines?.[0]?.method_title?.toLowerCase() ?? undefined;

  return {
    source: "woo",
    externalId: String(payload.id),
    customerName: customerName || billing.email,
    customerEmail: billing.email || undefined,
    customerPhone: billing.phone || undefined,
    companyName: billing.company || undefined,
    shippingAddress: shippingAddress || undefined,
    shippingMethod,
    paymentStatus: payload.status === "completed" ? "paid" : "pending",
    items,
    notes: payload.customer_note || undefined,
  };
}
