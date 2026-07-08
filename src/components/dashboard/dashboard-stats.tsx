"use client";

import Link from "next/link";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";
import {
  Package,
  Factory,
  PackageCheck,
  AlertTriangle,
  Hourglass,
  Clock,
  Users,
  Wrench,
} from "lucide-react";

interface Props {
  summary: {
    newToday: number;
    inProduction: number;
    ready: number;
    atRisk: number;
    awaitingApproval: number;
  };
  sourceCounts: Record<string, number>;
  operators: {
    name: string;
    completed: number;
    avgMinutes: number;
    inProgress: number;
  }[];
  complaints: {
    open: number;
    resolvedThisMonth: number;
    totalOrders: number;
  };
  topMachines: { name: string; count: number }[];
}

const SOURCE_LABELS: Record<string, string> = {
  woo: "WooCommerce",
  stacjonarne: "Stacjonarne",
  email: "Email",
  allegro: "Allegro",
  baselinker: "BaseLinker",
};

export function DashboardStats({
  summary,
  sourceCounts,
  operators,
  complaints,
  topMachines,
}: Props) {
  useRealtimeRefresh(["orders", "order_item_progress", "complaints"], "dashboard-realtime");

  const totalSourceOrders = Object.values(sourceCounts).reduce(
    (s, v) => s + v,
    0
  );
  const maxMachineCount = topMachines[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Kafelki podsumowania */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={<Package size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          value={summary.newToday}
          label="Nowe dzisiaj"
          href="/orders?filter=new_today"
        />
        <StatCard
          icon={<Factory size={18} className="text-amber-600" />}
          iconBg="bg-amber-50"
          value={summary.inProduction}
          label="W produkcji"
          href="/orders?filter=in_production"
        />
        <StatCard
          icon={<PackageCheck size={18} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          value={summary.ready}
          label="Gotowe"
          href="/orders?filter=ready"
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          iconBg="bg-amber-50"
          value={summary.atRisk}
          label="Zagrożony termin"
          href="/orders?filter=at_risk"
        />
        <StatCard
          icon={<Hourglass size={18} className="text-purple-600" />}
          iconBg="bg-purple-50"
          value={summary.awaitingApproval}
          label="Oczekuje na akceptację"
          href="/orders?filter=awaiting_approval"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Zamowienia wg zrodla */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            Źródła zamówień (30 dni)
          </h3>
          {totalSourceOrders > 0 ? (
            <div className="space-y-3">
              {Object.entries(sourceCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => (
                  <div key={source}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="text-zinc-700">
                        {SOURCE_LABELS[source] ?? source}
                      </span>
                      <span className="font-medium text-zinc-900">
                        {count}{" "}
                        <span className="text-zinc-400">
                          ({Math.round((count / totalSourceOrders) * 100)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-900 transition-all"
                        style={{
                          width: `${(count / totalSourceOrders) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[13px] text-zinc-400">Brak danych</p>
          )}
        </div>

        {/* Reklamacje */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            <AlertTriangle size={14} />
            Reklamacje
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-600">
                {complaints.open}
              </p>
              <p className="text-[11px] text-zinc-500">Otwarte</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-emerald-600">
                {complaints.resolvedThisMonth}
              </p>
              <p className="text-[11px] text-zinc-500">Zamknięte (30d)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-zinc-900">
                {complaints.totalOrders > 0
                  ? (
                      ((complaints.open + complaints.resolvedThisMonth) /
                        complaints.totalOrders) *
                      100
                    ).toFixed(1)
                  : "0"}
                %
              </p>
              <p className="text-[11px] text-zinc-500">% zamówień</p>
            </div>
          </div>
        </div>
      </div>

      {/* Operatorzy */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
          <Users size={14} />
          Operatorzy (ostatnie 30 dni)
        </h3>
        {operators.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="pb-2 pr-4">Operator</th>
                  <th className="pb-2 pr-4 text-right">Ukończonych</th>
                  <th className="pb-2 pr-4 text-right">Śr. czas (min)</th>
                  <th className="pb-2 text-right">W trakcie</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr
                    key={op.name}
                    className="border-b border-zinc-50 last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-medium text-zinc-900">
                      {op.name}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700">
                      {op.completed}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700">
                      {op.avgMinutes > 0 ? (
                        <span className="flex items-center justify-end gap-1">
                          <Clock size={12} className="text-zinc-400" />
                          {op.avgMinutes}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {op.inProgress > 0 ? (
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                          {op.inProgress}
                        </span>
                      ) : (
                        <span className="text-zinc-300">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-zinc-400">Brak danych</p>
        )}
      </div>

      {/* Top maszyny */}
      {topMachines.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            <Wrench size={14} />
            Najaktywniejsze maszyny (30 dni)
          </h3>
          <div className="space-y-3">
            {topMachines.map((m) => (
              <div key={m.name}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-zinc-700">{m.name}</span>
                  <span className="font-medium tabular-nums text-zinc-900">
                    {m.count} etapów
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${(m.count / maxMachineCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-zinc-900">{value}</p>
        <p className="text-[12px] text-zinc-500">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      {content}
    </div>
  );
}
