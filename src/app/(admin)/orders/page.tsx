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

  const [productsRes, contactsRes, companiesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("contacts")
      .select("id, full_name, email, phone, company_id")
      .order("full_name")
      .limit(200),
    supabase
      .from("companies")
      .select("id, name, nip")
      .order("name")
      .limit(200),
  ]);

  return (
    <div>
      <OrdersPageClient
        products={productsRes.data ?? []}
        orders={(orders ?? []) as unknown as Order[]}
        contacts={(contactsRes.data ?? []) as unknown as { id: string; full_name: string; email: string | null; phone: string | null; company_id: string | null }[]}
        companies={(companiesRes.data ?? []) as unknown as { id: string; name: string; nip: string | null }[]}
      />
    </div>
  );
}
