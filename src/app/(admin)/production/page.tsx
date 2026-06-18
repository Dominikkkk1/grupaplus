import { createClient } from "@/lib/supabase/server";
import { ProductionBoard } from "@/components/production/production-board";

export default async function ProductionPage() {
  const supabase = await createClient();

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("id, name, color")
    .order("name");

  const { data: activeItems } = await supabase
    .from("order_item_progress")
    .select(`
      id,
      step_id,
      status,
      order_item:order_items(
        description,
        quantity,
        order:orders(id, order_number, deadline, status)
      )
    `)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(100);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Produkcja</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Widok na zywo &mdash; pozycje w toku produkcji
        </p>
      </div>

      <ProductionBoard
        steps={(steps ?? []) as { id: string; name: string; color: string }[]}
        initialItems={(activeItems ?? []) as never[]}
      />
    </div>
  );
}
