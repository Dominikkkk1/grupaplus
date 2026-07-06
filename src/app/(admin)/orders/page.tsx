import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrdersPageClient, type Order } from "@/components/orders/orders-page-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();

  // Sprawdz role użytkownika
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const userRole = profile?.role ?? "client";

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      source,
      status,
      payment_status,
      deadline,
      is_priority,
      delivery_type,
      notes,
      created_at,
      contact:contacts(full_name),
      company:companies(name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  // Dodatkowe dane tylko dla admin (klient nie potrzebuje)
  let products: { id: string; name: string; sku: string | null; lead_time_days: number | null; base_price: number | null }[] = [];
  let contacts: { id: string; full_name: string; email: string | null; phone: string | null; company_id: string | null; is_blacklisted: boolean }[] = [];
  let companies: { id: string; name: string; nip: string | null }[] = [];

  if (userRole === "admin") {
    const [productsRes, contactsRes, companiesRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, lead_time_days, base_price")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("contacts")
        .select("id, full_name, email, phone, company_id, is_blacklisted")
        .order("full_name")
        .limit(200),
      supabase
        .from("companies")
        .select("id, name, nip")
        .order("name")
        .limit(200),
    ]);
    products = (productsRes.data ?? []) as typeof products;
    contacts = (contactsRes.data ?? []) as typeof contacts;
    companies = (companiesRes.data ?? []) as typeof companies;
  }

  return (
    <Suspense>
      <OrdersPageClient
        products={products}
        orders={(orders ?? []) as unknown as Order[]}
        contacts={contacts}
        companies={companies}
        userRole={userRole}
      />
    </Suspense>
  );
}
