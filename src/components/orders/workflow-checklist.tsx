"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, RotateCcw, GitFork, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";

interface StepProgress {
  id: string;
  step_order: number;
  status: string;
  branch_type?: string;
  completed_at: string | null;
  notes: string | null;
  step: { name: string; color: string };
  completed_by_user: { full_name: string } | null;
  machine: { name: string } | null;
}

export function WorkflowChecklist({
  orderItemId,
  steps,
}: {
  orderItemId: string;
  steps: StepProgress[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  useRealtimeRefresh(["order_item_progress"], "checklist-realtime-" + orderItemId);

  const hasBranches = steps.some((s) => s.branch_type === "branch_a" || s.branch_type === "branch_b");

  async function toggleStep(progressId: string, currentStatus: string) {
    setLoading(progressId);
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    const res = await fetch("/api/orders/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressId, status: newStatus }),
    });
    if (res.ok) router.refresh();
    setLoading(null);
  }

  if (!hasBranches) {
    // Linear — jak dotychczas
    return (
      <div className="divide-y divide-zinc-100">
        {steps.map((s, i) => (
          <StepRow
            key={s.id}
            step={s}
            canToggle={canToggleStep(s, i, steps)}
            loading={loading === s.id}
            onToggle={() => toggleStep(s.id, s.status)}
          />
        ))}
      </div>
    );
  }

  // Fork/Join — 3 sekcje
  const preFork = steps.filter((s) => (s.branch_type ?? "common") === "common" && s.step_order < 100);
  const branchA = steps.filter((s) => s.branch_type === "branch_a");
  const branchB = steps.filter((s) => s.branch_type === "branch_b");
  const postJoin = steps.filter((s) => (s.branch_type ?? "common") === "common" && s.step_order >= 100);

  return (
    <div>
      {/* Pre-fork */}
      {preFork.length > 0 && (
        <div className="divide-y divide-zinc-100">
          {preFork.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              canToggle={canToggleStep(s, i, preFork)}
              loading={loading === s.id}
              onToggle={() => toggleStep(s.id, s.status)}
            />
          ))}
        </div>
      )}

      {/* Fork marker */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <div className="h-px flex-1 bg-purple-200" />
        <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-500">
          <GitFork size={10} /> FORK
        </span>
        <div className="h-px flex-1 bg-purple-200" />
      </div>

      {/* Branches side by side */}
      <div className="grid grid-cols-2 gap-px bg-zinc-100">
        <div>
          <div className="bg-blue-50/50 px-3 py-1 text-[10px] font-semibold uppercase text-blue-600">
            A — Okładka
          </div>
          <div className="divide-y divide-zinc-100 bg-white">
            {branchA.map((s, i) => (
              <StepRow
                key={s.id}
                step={s}
                canToggle={canToggleStep(s, i, branchA)}
                loading={loading === s.id}
                onToggle={() => toggleStep(s.id, s.status)}
                compact
              />
            ))}
            {branchA.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-zinc-400">Brak kroków</div>
            )}
          </div>
        </div>
        <div>
          <div className="bg-emerald-50/50 px-3 py-1 text-[10px] font-semibold uppercase text-emerald-600">
            B — Wkład
          </div>
          <div className="divide-y divide-zinc-100 bg-white">
            {branchB.map((s, i) => (
              <StepRow
                key={s.id}
                step={s}
                canToggle={canToggleStep(s, i, branchB)}
                loading={loading === s.id}
                onToggle={() => toggleStep(s.id, s.status)}
                compact
              />
            ))}
            {branchB.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-zinc-400">Brak kroków</div>
            )}
          </div>
        </div>
      </div>

      {/* Join marker */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <div className="h-px flex-1 bg-purple-200" />
        <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-500">
          <GitMerge size={10} /> JOIN
        </span>
        <div className="h-px flex-1 bg-purple-200" />
      </div>

      {/* Post-join */}
      {postJoin.length > 0 && (
        <div className="divide-y divide-zinc-100">
          {postJoin.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              canToggle={canToggleStep(s, i, postJoin)}
              loading={loading === s.id}
              onToggle={() => toggleStep(s.id, s.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function canToggleStep(step: StepProgress, index: number, sectionSteps: StepProgress[]): boolean {
  const isCompleted = step.status === "completed";
  const isSkipped = step.status === "skipped";
  const isInProgress = step.status === "in_progress";
  if (isSkipped || isInProgress) return false;
  if (isCompleted) return true;
  // Prev step in THIS section must be done
  const prevCompleted = index === 0 || sectionSteps[index - 1].status === "completed" || sectionSteps[index - 1].status === "skipped";
  return prevCompleted;
}

function StepRow({
  step: s,
  canToggle,
  loading: isLoading,
  onToggle,
  compact,
}: {
  step: StepProgress;
  canToggle: boolean;
  loading: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const isCompleted = s.status === "completed";
  const isSkipped = s.status === "skipped";
  const isInProgress = s.status === "in_progress";
  const isRework = s.status === "rework";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 transition-colors",
        compact ? "py-2" : "px-4 py-3",
        isCompleted && "bg-emerald-50/30",
        isSkipped && "bg-zinc-50/50"
      )}
    >
      <button
        onClick={() => canToggle && onToggle()}
        disabled={!canToggle || isLoading}
        title={
          isSkipped ? "Pominięto" :
          isInProgress ? "W trakcie — zakończ przez skan" :
          !canToggle ? "Poprzedni etap musi być ukończony" :
          isCompleted ? "Cofnij" : "Oznacz jako ukończone"
        }
        className={cn(
          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
          compact ? "h-4 w-4" : "h-5 w-5",
          isCompleted ? "border-emerald-500 bg-emerald-500 text-white"
            : isSkipped ? "border-zinc-400 bg-zinc-200 text-zinc-500"
            : isInProgress ? "border-blue-400 bg-blue-50 text-blue-500"
            : isRework ? "border-red-400 bg-red-50 text-red-500"
            : canToggle ? "border-zinc-300 hover:border-zinc-400"
            : "border-zinc-200 bg-zinc-50 cursor-not-allowed"
        )}
      >
        {isLoading ? <Loader2 size={compact ? 8 : 10} className="animate-spin" />
          : isCompleted ? <Check size={compact ? 8 : 10} strokeWidth={3} />
          : isSkipped ? <Check size={compact ? 8 : 10} strokeWidth={2} className="opacity-50" />
          : isInProgress ? <Loader2 size={compact ? 7 : 8} />
          : isRework ? <RotateCcw size={compact ? 7 : 8} />
          : <Circle size={compact ? 5 : 6} className="text-zinc-300" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.step.color }} />
          <span className={cn(
            compact ? "text-[12px]" : "text-[13px]",
            "font-medium",
            isCompleted ? "text-zinc-500" : isSkipped ? "text-zinc-400 line-through" : "text-zinc-900"
          )}>
            {s.step.name}
          </span>
          {isInProgress && (
            <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-600">W trakcie</span>
          )}
        </div>
        {isCompleted && (
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-400">
            {s.completed_by_user && <span>{s.completed_by_user.full_name}</span>}
            {s.machine && <span>na {s.machine.name}</span>}
            {s.completed_at && (
              <span>{new Date(s.completed_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
