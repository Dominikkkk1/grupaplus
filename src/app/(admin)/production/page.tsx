import { createClient } from "@/lib/supabase/server";
import {
  ProductionBoard,
  type ProductionItem,
  type MachineGroup,
} from "@/components/production/production-board";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const userRole = profile?.role ?? "operator";

  // Pobierz WSZYSTKIE etapy per pozycja (nie tylko pending/in_progress)
  // Potrzebne do progress bara
  const [progressRes, groupsRes, stepsRes] = await Promise.all([
    supabase
      .from("order_item_progress")
      .select(`
        id,
        order_item_id,
        step_id,
        step_order,
        status,
        branch_type,
        started_by_user:users!order_item_progress_started_by_fkey(full_name),
        step:workflow_steps(name, color, machine_group_id),
        order_item:order_items(
          id,
          description,
          quantity,
          is_completed,
          order:orders(
            id,
            order_number,
            deadline,
            status,
            is_priority,
            contact:contacts(
              full_name,
              company:companies(name)
            )
          )
        )
      `)
      .order("step_order", { ascending: true })
      .limit(500),
    supabase
      .from("machine_groups")
      .select("id, name")
      .order("name"),
    supabase
      .from("workflow_steps")
      .select("id, name, color, machine_group_id")
      .order("name"),
  ]);

  // Grupuj progress po order_item_id, żeby mieć pełny obraz per pozycja
  const progressByItem = new Map<string, NonNullable<typeof progressRes.data>>();
  for (const p of progressRes.data ?? []) {
    const itemId = p.order_item_id;
    if (!itemId) continue;
    const existing = progressByItem.get(itemId) ?? [];
    existing.push(p);
    progressByItem.set(itemId, existing);
  }

  // Buduj ProductionItem[] — tylko pozycje które mają przynajmniej 1 etap pending/in_progress
  const items: ProductionItem[] = [];
  const seenItems = new Set<string>();

  for (const [itemId, progressList] of progressByItem) {
    if (seenItems.has(itemId)) continue;
    seenItems.add(itemId);

    const hasActive = progressList.some(
      (p) => p.status === "pending" || p.status === "in_progress"
    );
    if (!hasActive) continue;

    const first = progressList[0];
    const orderItem = first.order_item as unknown as {
      id: string;
      description: string;
      quantity: number;
      is_completed: boolean;
      order: {
        id: string;
        order_number: string;
        deadline: string | null;
        status: string;
        is_priority: boolean;
        contact: {
          full_name: string;
          company: { name: string } | null;
        } | null;
      };
    } | null;

    if (!orderItem?.order) continue;
    // Pomijaj zamowienia shipped/delivered/cancelled
    if (["shipped", "delivered", "cancelled"].includes(orderItem.order.status)) continue;

    const steps = progressList
      .sort((a, b) => {
        const aOrder = a.step_order ?? 0;
        const bOrder = b.step_order ?? 0;
        return aOrder - bOrder;
      })
      .map((p) => {
        const stepData = p.step as unknown as { name: string; color: string; machine_group_id: string | null } | null;
        return {
          progressId: p.id,
          stepId: p.step_id,
          name: stepData?.name ?? "?",
          color: stepData?.color ?? "#888",
          machineGroupId: stepData?.machine_group_id ?? null,
          status: p.status as "pending" | "in_progress" | "completed" | "skipped" | "rework",
          branchType: (p.branch_type ?? "common") as "common" | "branch_a" | "branch_b",
          operatorName: p.status === "in_progress"
            ? (p.started_by_user as unknown as { full_name: string } | null)?.full_name ?? null
            : null,
        };
      });

    const completed = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
    const total = steps.length;
    const currentStep = steps.find((s) => s.status === "in_progress") ?? steps.find((s) => s.status === "pending");

    items.push({
      itemId,
      orderId: orderItem.order.id,
      orderNumber: orderItem.order.order_number,
      description: orderItem.description,
      quantity: orderItem.quantity,
      deadline: orderItem.order.deadline,
      isPriority: orderItem.order.is_priority,
      contactName: orderItem.order.contact?.full_name ?? null,
      companyName: orderItem.order.contact?.company?.name ?? null,
      operatorName: currentStep?.operatorName ?? null,
      currentStepMachineGroupId: currentStep?.machineGroupId ?? null,
      steps,
      completedCount: completed,
      totalCount: total,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">Produkcja</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Widok na żywo - pozycje w toku produkcji
        </p>
      </div>

      <ProductionBoard
        items={items}
        machineGroups={(groupsRes.data ?? []) as unknown as MachineGroup[]}
        userRole={userRole}
      />
    </div>
  );
}
