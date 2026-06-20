import { createClient } from "@/lib/supabase/server";
import { ProductsPageClient } from "@/components/products/products-page-client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(`
      id, name, sku, category, base_price, description,
      product_workflow(
        step_order,
        step:workflow_steps(name, color)
      )
    `)
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <ProductsPageClient
        products={(products ?? []) as unknown as { id: string; name: string; sku: string | null; category: string; base_price: number | null; description: string | null; product_workflow: { step_order: number; step: { name: string; color: string } }[] }[]}
      />
    </div>
  );
}
