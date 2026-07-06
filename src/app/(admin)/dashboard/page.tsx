import { createClient } from "@/lib/supabase/server";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Kafelki podsumowania
  const [newTodayRes, inProductionRes, readyRes, overdueRes, awaitingApprovalRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_production"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .lt("deadline", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .not("status", "in", "(shipped,delivered,cancelled)"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_approval"),
  ]);

  // Zamowienia wg zrodla (ostatnie 30 dni)
  const { data: sourceData } = await supabase
    .from("orders")
    .select("source")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const sourceCounts: Record<string, number> = {};
  for (const row of sourceData ?? []) {
    sourceCounts[row.source] = (sourceCounts[row.source] ?? 0) + 1;
  }

  // Statystyki operatorów (ostatnie 30 dni) — rownolegle
  const [{ data: operatorData }, { data: operatorUsers }] = await Promise.all([
    supabase
      .from("order_item_progress")
      .select("completed_by, started_at, completed_at, status")
      .in("status", ["completed", "in_progress"])
      .gte("completed_at", thirtyDaysAgo.toISOString())
      .not("completed_by", "is", null),
    supabase
      .from("users")
      .select("id, full_name")
      .in("role", ["admin", "operator"])
      .eq("is_active", true),
  ]);

  const userMap = new Map<string, string>();
  for (const u of operatorUsers ?? []) {
    userMap.set(u.id, u.full_name);
  }

  // Agreguj dane operatorów
  const operatorMap = new Map<
    string,
    { completed: number; totalSeconds: number; inProgress: number }
  >();

  for (const row of operatorData ?? []) {
    const userId = row.completed_by as string;
    if (!userMap.has(userId)) continue;

    if (!operatorMap.has(userId)) {
      operatorMap.set(userId, { completed: 0, totalSeconds: 0, inProgress: 0 });
    }
    const stats = operatorMap.get(userId)!;

    if (row.status === "completed") {
      stats.completed++;
      if (row.started_at && row.completed_at) {
        const seconds =
          (new Date(row.completed_at).getTime() -
            new Date(row.started_at).getTime()) /
          1000;
        if (seconds > 0 && seconds < 86400) {
          stats.totalSeconds += seconds;
        }
      }
    }
    if (row.status === "in_progress") {
      stats.inProgress++;
    }
  }

  const operators = Array.from(operatorMap.entries())
    .map(([userId, stats]) => ({
      name: userMap.get(userId) ?? "—",
      completed: stats.completed,
      avgMinutes:
        stats.completed > 0
          ? Math.round(stats.totalSeconds / stats.completed / 60)
          : 0,
      inProgress: stats.inProgress,
    }))
    .sort((a, b) => b.completed - a.completed);

  // Reklamacje
  const [openComplaintsRes, resolvedThisMonthRes, totalOrdersRes] =
    await Promise.all([
      supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .in("status", ["resolved", "rejected"])
        .gte("resolved_at", thirtyDaysAgo.toISOString()),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),
    ]);

  // Top 5 maszyn
  const { data: machineData } = await supabase
    .from("order_item_progress")
    .select("machine_id, machine:machines(name)")
    .eq("status", "completed")
    .gte("completed_at", thirtyDaysAgo.toISOString())
    .not("machine_id", "is", null);

  const machineCounts = new Map<string, { name: string; count: number }>();
  for (const row of machineData ?? []) {
    const mid = row.machine_id as string;
    const mname = (row.machine as unknown as { name: string } | null)?.name ?? "—";
    if (!machineCounts.has(mid)) {
      machineCounts.set(mid, { name: mname, count: 0 });
    }
    machineCounts.get(mid)!.count++;
  }

  const topMachines = Array.from(machineCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-zinc-900">Dashboard</h1>

      <DashboardStats
        summary={{
          newToday: newTodayRes.count ?? 0,
          inProduction: inProductionRes.count ?? 0,
          ready: readyRes.count ?? 0,
          atRisk: overdueRes.count ?? 0,
          awaitingApproval: awaitingApprovalRes.count ?? 0,
        }}
        sourceCounts={sourceCounts}
        operators={operators}
        complaints={{
          open: openComplaintsRes.count ?? 0,
          resolvedThisMonth: resolvedThisMonthRes.count ?? 0,
          totalOrders: totalOrdersRes.count ?? 0,
        }}
        topMachines={topMachines}
      />
    </div>
  );
}
