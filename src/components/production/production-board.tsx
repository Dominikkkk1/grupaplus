"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Factory, Clock, AlertTriangle, CheckCircle2, ListTodo } from "lucide-react";

export interface Step {
  id: string;
  name: string;
  color: string;
  machine_group_id: string | null;
}

export interface ActiveItem {
  id: string;
  step_id: string;
  status: string;
  started_by_user: { full_name: string } | null;
  order_item: {
    description: string;
    quantity: number;
    order: {
      id: string;
      order_number: string;
      deadline: string | null;
      status: string;
    };
  } | null;
}

export interface MachineGroup {
  id: string;
  name: string;
}

export function ProductionBoard({
  steps,
  initialItems,
  machineGroups = [],
  userRole = "admin",
}: {
  steps: Step[];
  initialItems: ActiveItem[];
  machineGroups?: MachineGroup[];
  userRole?: string;
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOperator = userRole === "operator";

  // Multi-group filtr — operator z sessionStorage, admin wszystko
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupResolved, setGroupResolved] = useState(false);

  // Odczytaj grupy z sessionStorage (ustawione na /scan)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("scan_group_ids");
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        if (ids.length > 0) setSelectedGroupIds(ids);
      }
    } catch {}
    setGroupResolved(true);
  }, []);

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) => {
      const next = prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId];
      return next;
    });
  }

  // Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("production-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_item_progress" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 300);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Filtrowane etapy — multi-group
  const filteredSteps = useMemo(() => {
    if (selectedGroupIds.length === 0) return steps;
    return steps.filter((s) => s.machine_group_id && selectedGroupIds.includes(s.machine_group_id));
  }, [steps, selectedGroupIds]);

  // Grupuj pozycje wg etapu workflow
  const stepGroups = useMemo(() => {
    const groups = new Map<string, ActiveItem[]>();
    for (const step of filteredSteps) {
      groups.set(step.id, []);
    }
    for (const item of initialItems) {
      const existing = groups.get(item.step_id);
      if (existing) {
        existing.push(item);
      }
    }
    return groups;
  }, [filteredSteps, initialItems]);

  // Statystyki
  const filteredStepIds = new Set(filteredSteps.map((s) => s.id));
  const filteredItems = initialItems.filter((i) => filteredStepIds.has(i.step_id));
  const pendingCount = filteredItems.filter((i) => i.status === "pending").length;
  const inProgressCount = filteredItems.filter((i) => i.status === "in_progress").length;

  const now = Date.now();
  const urgentCount = filteredItems.filter((i) => {
    const deadline = i.order_item?.order?.deadline;
    if (!deadline) return false;
    return new Date(deadline).getTime() < now + 24 * 60 * 60 * 1000;
  }).length;

  // "Twoje zadania" — pending items w filtrowanych etapach, sortowane po pilnosci
  const todoItems = useMemo(() => {
    if (!isOperator || selectedGroupIds.length === 0) return [];
    return filteredItems
      .filter((i) => i.status === "pending")
      .sort((a, b) => {
        const dA = a.order_item?.order?.deadline;
        const dB = b.order_item?.order?.deadline;
        // Pilne (z deadline) na gorze
        if (dA && !dB) return -1;
        if (!dA && dB) return 1;
        if (dA && dB) return new Date(dA).getTime() - new Date(dB).getTime();
        return 0;
      });
  }, [isOperator, selectedGroupIds, filteredItems]);

  const [showAllTodo, setShowAllTodo] = useState(false);
  const visibleTodo = showAllTodo ? todoItems : todoItems.slice(0, 5);

  return (
    <>
      {/* Filtr stanowisk — pigulki multi-select */}
      {machineGroups.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedGroupIds([])}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                selectedGroupIds.length === 0
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              Wszystkie
            </button>
            {machineGroups.map((g) => {
              const isSelected = selectedGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
          {isOperator && selectedGroupIds.length === 0 && groupResolved && (
            <p className="mt-2 text-[11px] text-amber-600">
              Wybierz stanowiska na /scan — filtr ustawią się automatycznie
            </p>
          )}
        </div>
      )}

      {/* Twoje zadania — tylko operator z wybranymi grupami */}
      {isOperator && todoItems.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-blue-700">
            <ListTodo size={14} />
            Do zrobienia ({todoItems.length})
          </h3>
          <div className="space-y-2">
            {visibleTodo.map((item) => (
              <ProductionCard key={item.id} item={item} now={now} />
            ))}
          </div>
          {todoItems.length > 5 && (
            <button
              onClick={() => setShowAllTodo(!showAllTodo)}
              className="mt-2 text-[12px] font-medium text-blue-600 hover:text-blue-800"
            >
              {showAllTodo ? "Pokaż mniej" : `Pokaż wszystkie (${todoItems.length})`}
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard
          icon={<Clock size={18} className="text-amber-600" />}
          iconBg="bg-amber-50"
          value={pendingCount}
          label="Oczekujące"
        />
        <StatCard
          icon={<Factory size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          value={inProgressCount}
          label="W realizacji"
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-red-600" />}
          iconBg="bg-red-50"
          value={urgentCount}
          label="Zagrożony termin"
        />
      </div>

      {/* Board */}
      {filteredSteps.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {filteredSteps.map((step) => {
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
                    items.map((item) => (
                      <ProductionCard key={item.id} item={item} now={now} />
                    ))
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
          <p className="text-sm font-medium text-zinc-900">
            {selectedGroupIds.length > 0 ? "Brak etapów dla wybranych stanowisk" : "Brak danych produkcyjnych"}
          </p>
          <p className="mt-1 text-[13px] text-zinc-500">
            {selectedGroupIds.length > 0
              ? "Wybierz inne stanowiska lub \"Wszystkie\"."
              : "Etapy workflow pojawią się po skonfigurowaniu produktów."}
          </p>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
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
    </div>
  );
}

function ProductionCard({ item, now }: { item: ActiveItem; now: number }) {
  const orderItem = item.order_item;
  const deadline = orderItem?.order?.deadline;
  const orderId = orderItem?.order?.id;
  const isInProgress = item.status === "in_progress";
  const operatorName = item.started_by_user?.full_name;

  let borderClass = "border-zinc-200";
  let isUrgent = false;
  let isOverdue = false;

  if (isInProgress) {
    borderClass = "border-blue-300 bg-blue-50/40";
  } else if (deadline) {
    const deadlineMs = new Date(deadline).getTime();
    if (deadlineMs < now) {
      borderClass = "border-red-400 bg-red-50/30";
      isOverdue = true;
    } else if (deadlineMs < now + 24 * 60 * 60 * 1000) {
      borderClass = "border-amber-400 bg-amber-50/30";
      isUrgent = true;
    }
  }

  const card = (
    <div
      className={`rounded-lg border ${borderClass} bg-white p-3 shadow-sm transition-colors hover:border-zinc-300`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-zinc-900">
          {orderItem?.description ?? "\u2014"}
        </p>
        {isInProgress && (
          <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
            W TRAKCIE
          </span>
        )}
        {!isInProgress && (isOverdue || isUrgent) && (
          <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${isOverdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {isOverdue ? "SPÓŹNIONE" : "PILNE"}
          </span>
        )}
      </div>
      {isInProgress && operatorName && (
        <p className="mt-1 text-[11px] font-medium text-blue-600">
          {operatorName}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-zinc-500">
          {orderItem?.quantity ?? 0} szt.
        </span>
        <span className="font-mono text-[11px] text-zinc-400">
          {orderItem?.order?.order_number ?? ""}
        </span>
      </div>
      {deadline && new Date(deadline).getTime() < now + 24 * 60 * 60 * 1000 && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600">
          <Clock size={11} />
          {new Date(deadline).toLocaleDateString("pl-PL")}
        </div>
      )}
    </div>
  );

  if (orderId) {
    return (
      <Link href={`/orders/${orderId}`} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
