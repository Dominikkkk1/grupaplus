import { createClient } from "@/lib/supabase/server";
import {
  ProductionBoard,
  type Step,
  type ActiveItem,
  type MachineGroup,
} from "@/components/production/production-board";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const supabase = await createClient();

  // Pobierz role uzytkownika
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const userRole = profile?.role ?? "operator";

  const [stepsRes, itemsRes, groupsRes] = await Promise.all([
    supabase
      .from("workflow_steps")
      .select("id, name, color, machine_group_id")
      .order("name"),
    supabase
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
      .limit(100),
    supabase
      .from("machine_groups")
      .select("id, name")
      .order("name"),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Produkcja</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Widok na zywo &mdash; pozycje w toku produkcji
        </p>
      </div>

      <ProductionBoard
        steps={(stepsRes.data ?? []) as unknown as Step[]}
        initialItems={(itemsRes.data ?? []) as unknown as ActiveItem[]}
        machineGroups={(groupsRes.data ?? []) as unknown as MachineGroup[]}
        userRole={userRole}
      />
    </div>
  );
}
