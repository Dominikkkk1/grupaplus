import { createClient } from "@/lib/supabase/server";
import { ShippingPageClient, type ShippingOrder } from "@/components/orders/shipping-page-client";

export const dynamic = "force-dynamic";

/**
 * "Do wysyłki" — paczki gotowe do wydania, rozbite na przewoźników.
 *
 * Prośba Grupy Plus: móc zobaczyć osobno przesyłki dla InPostu, DPD i reszty
 * kurierów, żeby spakować wszystko przed godziną odbioru danego przewoźnika.
 *
 * Filtrujemy po stronie bazy (nie w przeglądarce), bo to lista robocza —
 * musi pokazywać komplet, a nie 200 ostatnich zamówień.
 */
export default async function ShippingPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      carrier,
      shipping_method,
      delivery_type,
      deadline,
      is_priority,
      tracking_number,
      contact:contacts(full_name, phone),
      company:companies(name)
    `)
    .eq("status", "ready")
    .order("is_priority", { ascending: false })
    .order("deadline", { nullsFirst: false });

  // Godziny odbioru ustawia admin w /settings/carriers
  const { data: carrierSettings } = await supabase
    .from("carrier_settings")
    .select("carrier, pickup_time, notes");

  const pickupTimes: Record<string, { time: string | null; notes: string | null }> =
    Object.fromEntries(
      (carrierSettings ?? []).map((c) => [
        c.carrier as string,
        {
          // z bazy "16:00:00" -> "16:00"
          time: c.pickup_time ? String(c.pickup_time).slice(0, 5) : null,
          notes: (c.notes as string | null) ?? null,
        },
      ])
    );

  return (
    <ShippingPageClient
      orders={(orders ?? []) as unknown as ShippingOrder[]}
      pickupTimes={pickupTimes}
    />
  );
}
