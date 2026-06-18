import { createClient } from "@/lib/supabase/server";
import { ClipboardList, Plus, ArrowRight } from "lucide-react";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(`
      *,
      product_workflow(
        step_order,
        step:workflow_steps(name, color)
      )
    `)
    .eq("is_active", true)
    .order("name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Produkty</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Katalog produktow z przypisanymi workflow
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
          <Plus size={16} />
          Dodaj produkt
        </button>
      </div>

      {products && products.length > 0 ? (
        <div className="grid gap-3">
          {products.map((product) => {
            const workflow = (
              product.product_workflow as {
                step_order: number;
                step: { name: string; color: string };
              }[]
            )?.sort((a, b) => a.step_order - b.step_order);

            return (
              <div
                key={product.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[14px] font-medium text-zinc-900">
                      {product.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-3">
                      {product.sku && (
                        <span className="font-mono text-[12px] text-zinc-400">
                          {product.sku}
                        </span>
                      )}
                      {product.category && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                          {product.category === "maly_format"
                            ? "Maly format"
                            : product.category === "duzy_format"
                              ? "Duzy format"
                              : product.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Workflow steps */}
                {workflow && workflow.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    {workflow.map((pw, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium"
                          style={{
                            borderColor: pw.step.color + "40",
                            backgroundColor: pw.step.color + "10",
                            color: pw.step.color,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: pw.step.color }}
                          />
                          {pw.step.name}
                        </span>
                        {i < workflow.length - 1 && (
                          <ArrowRight size={12} className="text-zinc-300" />
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <ClipboardList size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">Brak produktow</p>
        </div>
      )}
    </div>
  );
}
