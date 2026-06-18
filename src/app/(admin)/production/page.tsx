import { createClient } from "@/lib/supabase/server";
import { Factory, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function ProductionPage() {
  const supabase = await createClient();

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("id, name, color")
    .order("name");

  const { data: activeItems } = await supabase
    .from("order_item_progress")
    .select(`
      *,
      order_item:order_items(
        description,
        quantity,
        order:orders(order_number, deadline, status)
      ),
      step:workflow_steps(name, color)
    `)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(100);

  const stepGroups = new Map<string, typeof activeItems>();
  if (steps) {
    for (const step of steps) {
      stepGroups.set(step.id, []);
    }
  }
  if (activeItems) {
    for (const item of activeItems) {
      const existing = stepGroups.get(item.step_id) ?? [];
      existing.push(item);
      stepGroups.set(item.step_id, existing);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Produkcja</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Widok na zywo &mdash; pozycje w toku produkcji
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-900">
                {activeItems?.filter((i) => i.status === "pending").length ?? 0}
              </p>
              <p className="text-[12px] text-zinc-500">Oczekujace</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Factory size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-900">
                {activeItems?.filter((i) => i.status === "in_progress").length ?? 0}
              </p>
              <p className="text-[12px] text-zinc-500">W realizacji</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-900">0</p>
              <p className="text-[12px] text-zinc-500">Zagrozony termin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      {steps && steps.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {steps.map((step) => {
            const items = stepGroups.get(step.id) ?? [];
            return (
              <div
                key={step.id}
                className="w-72 flex-shrink-0 rounded-lg border border-zinc-200 bg-zinc-50/50"
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: step.color }}
                  />
                  <h3 className="text-[13px] font-semibold text-zinc-900">
                    {step.name}
                  </h3>
                  <span className="ml-auto rounded-md bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  {items.length > 0 ? (
                    items.map((item) => {
                      const orderItem = item.order_item as {
                        description: string;
                        quantity: number;
                        order: { order_number: string; deadline: string | null };
                      } | null;
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
                        >
                          <p className="text-[13px] font-medium text-zinc-900">
                            {orderItem?.description ?? "—"}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[12px] text-zinc-500">
                              {orderItem?.quantity ?? 0} szt.
                            </span>
                            <span className="font-mono text-[11px] text-zinc-400">
                              {orderItem?.order?.order_number ?? ""}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-6 text-center text-[12px] text-zinc-400">
                      Brak pozycji
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <CheckCircle2 size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">Brak danych produkcyjnych</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Etapy workflow pojawia sie po skonfigurowaniu produktow.
          </p>
        </div>
      )}
    </div>
  );
}
