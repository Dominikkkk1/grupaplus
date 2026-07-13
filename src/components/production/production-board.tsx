"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Factory, Clock, AlertTriangle, Search, Star, ListTodo } from "lucide-react";

// --- Typy ---

export interface StepProgress {
  progressId: string;
  stepId: string;
  name: string;
  color: string;
  machineGroupId: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped" | "rework";
  branchType: "common" | "branch_a" | "branch_b";
  operatorName: string | null;
}

export interface ProductionItem {
  itemId: string;
  orderId: string;
  orderNumber: string;
  description: string;
  quantity: number;
  deadline: string | null;
  isPriority: boolean;
  contactName: string | null;
  companyName: string | null;
  operatorName: string | null;
  currentStepId: string | null;
  currentStepName: string | null;
  steps: StepProgress[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

export interface ActiveStep {
  id: string;
  name: string;
  color: string;
}

// --- Komponent ---

export function ProductionBoard({
  items,
  activeSteps = [],
  userRole = "admin",
}: {
  items: ProductionItem[];
  activeSteps?: ActiveStep[];
  userRole?: string;
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOperator = userRole === "operator";

  // Filtr etapów produkcji
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [filterResolved, setFilterResolved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("production_step_ids");
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        if (ids.length > 0) setSelectedStepIds(ids);
      }
    } catch {}
    setFilterResolved(true);
  }, []);

  // Persist filter to sessionStorage
  useEffect(() => {
    if (!filterResolved) return;
    if (selectedStepIds.length > 0) {
      sessionStorage.setItem("production_step_ids", JSON.stringify(selectedStepIds));
    } else {
      sessionStorage.removeItem("production_step_ids");
    }
  }, [selectedStepIds, filterResolved]);

  function toggleStep(stepId: string) {
    setSelectedStepIds((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    );
  }

  // Realtime
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

  // Filtrowanie + wyszukiwanie
  const filteredItems = useMemo(() => {
    let result = items;

    // Filtr etapów — pokazuj pozycje których AKTUALNY etap pasuje
    if (selectedStepIds.length > 0) {
      result = result.filter((item) =>
        item.currentStepId && selectedStepIds.includes(item.currentStepId)
      );
    }

    // Wyszukiwanie
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.orderNumber.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.contactName && item.contactName.toLowerCase().includes(q)) ||
          (item.companyName && item.companyName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, selectedStepIds, searchQuery]);

  // Sortowanie: spóźnione > pilne < 24h > in_progress > pending
  const sortedItems = useMemo(() => {
    const now = Date.now();
    return [...filteredItems].sort((a, b) => {
      const scoreA = urgencyScore(a, now);
      const scoreB = urgencyScore(b, now);
      if (scoreA !== scoreB) return scoreB - scoreA; // wyższy score = wyżej
      // Przy równym score — wcześniejszy deadline wyżej
      const dA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const dB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return dA - dB;
    });
  }, [filteredItems]);

  // Statystyki
  const now = Date.now();
  const inProgressCount = filteredItems.filter((i) => i.steps.some((s) => s.status === "in_progress")).length;
  const pendingCount = filteredItems.filter((i) => i.steps.every((s) => s.status !== "in_progress") && i.steps.some((s) => s.status === "pending")).length;
  const urgentCount = filteredItems.filter((i) => {
    if (!i.deadline) return false;
    return new Date(i.deadline).getTime() < now + 24 * 60 * 60 * 1000;
  }).length;

  // Panel "Do zrobienia" operatora
  const todoItems = useMemo(() => {
    if (!isOperator || selectedStepIds.length === 0) return [];
    return sortedItems.filter(
      (i) => !i.steps.some((s) => s.status === "in_progress") && i.steps.some((s) => s.status === "pending")
    );
  }, [isOperator, selectedStepIds, sortedItems]);

  const [showAllTodo, setShowAllTodo] = useState(false);
  const visibleTodo = showAllTodo ? todoItems : todoItems.slice(0, 5);

  return (
    <>
      {/* Wyszukiwarka + filtr */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Szukaj zamówienia, produktu, klienta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>

        {activeSteps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedStepIds([])}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                selectedStepIds.length === 0
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              Wszystkie
            </button>
            {activeSteps.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleStep(s.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  selectedStepIds.includes(s.id)
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOperator && selectedStepIds.length === 0 && filterResolved && (
        <p className="mb-4 text-[11px] text-amber-600">
          Wybierz etap aby zobaczyć pozycje do realizacji
        </p>
      )}

      {/* Kafelki statystyk */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard icon={<Factory size={18} className="text-blue-600" />} iconBg="bg-blue-50" value={inProgressCount} label="W realizacji" />
        <StatCard icon={<Clock size={18} className="text-amber-600" />} iconBg="bg-amber-50" value={pendingCount} label="Oczekujące" />
        <StatCard icon={<AlertTriangle size={18} className="text-red-600" />} iconBg="bg-red-50" value={urgentCount} label="Zagrożony termin" />
      </div>

      {/* Panel "Do zrobienia" — operator */}
      {isOperator && todoItems.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-blue-700">
            <ListTodo size={14} />
            Do zrobienia ({todoItems.length})
          </h3>
          <div className="space-y-2">
            {visibleTodo.map((item) => (
              <ProductionCard key={item.itemId} item={item} now={now} />
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

      {/* Lista pozycji */}
      {sortedItems.length > 0 ? (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <ProductionCard key={item.itemId} item={item} now={now} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center">
          <p className="text-sm font-medium text-zinc-900">
            {searchQuery ? "Brak wyników wyszukiwania" : selectedStepIds.length > 0 ? "Brak pozycji na wybranych etapach" : "Brak pozycji w produkcji"}
          </p>
          <p className="mt-1 text-[13px] text-zinc-500">
            {searchQuery ? "Spróbuj inną frazę." : "Pozycje pojawią się po rozpoczęciu realizacji zamówień."}
          </p>
        </div>
      )}

      {/* Licznik */}
      {sortedItems.length > 0 && (
        <p className="mt-3 text-right text-[11px] text-zinc-400">
          {sortedItems.length} z {items.length} pozycji
        </p>
      )}
    </>
  );
}

// --- Urgency score ---

function urgencyScore(item: ProductionItem, now: number): number {
  const hasInProgress = item.steps.some((s) => s.status === "in_progress");
  if (!item.deadline) return hasInProgress ? 2 : 0;

  const deadlineMs = new Date(item.deadline).getTime();
  if (deadlineMs < now) return 10 + (item.isPriority ? 1 : 0); // spóźnione
  if (deadlineMs < now + 24 * 60 * 60 * 1000) return 5 + (item.isPriority ? 1 : 0); // pilne < 24h
  if (hasInProgress) return 2;
  return 0;
}

// --- Karta pozycji ---

function ProductionCard({ item, now }: { item: ProductionItem; now: number }) {
  const deadline = item.deadline;
  let isOverdue = false;
  let isUrgent = false;
  const hasInProgress = item.steps.some((s) => s.status === "in_progress");

  if (deadline) {
    const deadlineMs = new Date(deadline).getTime();
    if (deadlineMs < now) isOverdue = true;
    else if (deadlineMs < now + 24 * 60 * 60 * 1000) isUrgent = true;
  }

  let borderClass = "border-zinc-200";
  if (isOverdue) borderClass = "border-red-300 bg-red-50/30";
  else if (isUrgent) borderClass = "border-amber-300 bg-amber-50/30";
  else if (hasInProgress) borderClass = "border-blue-200 bg-blue-50/20";

  return (
    <Link href={`/orders/${item.orderId}`} className="block">
      <div className={`rounded-lg border ${borderClass} bg-white p-3 shadow-sm transition-colors hover:border-zinc-400`}>
        {/* Linia 1: numer, opis, termin, badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {item.isPriority && <Star size={13} className="flex-shrink-0 fill-amber-400 text-amber-400" />}
            <span className="flex-shrink-0 font-mono text-[12px] text-zinc-500">{item.orderNumber}</span>
            <span className="truncate text-[13px] font-medium text-zinc-900">{item.description}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {deadline && (
              <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-red-600 font-medium" : isUrgent ? "text-amber-600 font-medium" : "text-zinc-400"}`}>
                <Clock size={11} />
                {formatDeadline(deadline, now)}
              </span>
            )}
            {isOverdue && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">SPÓŹNIONE</span>}
            {isUrgent && !isOverdue && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">PILNE</span>}
          </div>
        </div>

        {/* Linia 2: klient, ilość, operator */}
        <div className="mt-1 flex items-center gap-3 text-[12px] text-zinc-500">
          <span className="truncate">{item.companyName ?? item.contactName ?? "—"}</span>
          <span className="flex-shrink-0">{item.quantity} szt.</span>
          {item.operatorName && (
            <span className="ml-auto flex-shrink-0 text-[11px] font-medium text-blue-600">{item.operatorName}</span>
          )}
        </div>

        {/* Linia 3: etapy jako pillsy */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {item.steps.map((step) => (
            <StepPill key={step.progressId} step={step} />
          ))}
        </div>

        {/* Linia 4: progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full transition-all ${
                item.progressPercent >= 100 ? "bg-emerald-500" : item.progressPercent > 0 ? "bg-blue-500" : "bg-zinc-200"
              }`}
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
          <span className="flex-shrink-0 text-[11px] font-medium text-zinc-400">{item.progressPercent}%</span>
        </div>
      </div>
    </Link>
  );
}

// --- Etap pill ---

function StepPill({ step }: { step: StepProgress }) {
  const isCompleted = step.status === "completed" || step.status === "skipped";
  const isActive = step.status === "in_progress";

  let branchLabel = "";
  if (step.branchType === "branch_a") branchLabel = "(A)";
  if (step.branchType === "branch_b") branchLabel = "(B)";

  if (isCompleted) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {step.name}{branchLabel}
      </span>
    );
  }

  if (isActive) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        {step.name}{branchLabel}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full border border-zinc-300 bg-white" />
      {step.name}{branchLabel}
    </span>
  );
}

// --- StatCard ---

function StatCard({ icon, iconBg, value, label }: { icon: React.ReactNode; iconBg: string; value: number; label: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-xl font-semibold text-zinc-900 sm:text-2xl">{value}</p>
          <p className="text-[11px] text-zinc-500 sm:text-[12px]">{label}</p>
        </div>
      </div>
    </div>
  );
}

// --- Formatowanie deadline ---

function formatDeadline(deadline: string, now: number): string {
  const d = new Date(deadline);
  const diff = d.getTime() - now;
  const today = new Date(now);
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000);

  if (diff < 0) {
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  }
  if (d.toDateString() === today.toDateString()) {
    return `dziś ${d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (d.toDateString() === tomorrow.toDateString()) {
    return `jutro ${d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
