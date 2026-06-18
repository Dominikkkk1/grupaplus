import { createClient } from "@/lib/supabase/server";
import { OrdersPageClient, type Order } from "@/components/orders/orders-page-client";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      source,
      status,
      payment_status,
      created_at,
      contact:contacts(full_name),
      company:companies(name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <OrdersPageClient
        products={products ?? []}
        orders={(orders ?? []) as unknown as Order[]}
      />
    </div>
  );
}
