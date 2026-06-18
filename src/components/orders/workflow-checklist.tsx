"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgress {
  id: string;
  step_order: number;
  status: string;
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

  async function toggleStep(progressId: string, currentStatus: string) {
    setLoading(progressId);

    const newStatus = currentStatus === "completed" ? "pending" : "completed";

    const res = await fetch("/api/orders/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressId, status: newStatus }),
    });

    if (res.ok) {
      router.refresh();
    }

    setLoading(null);
  }

  return (
    <div className="divide-y divide-zinc-100">
      {steps.map((s, i) => {
        const isCompleted = s.status === "completed";
        const isRework = s.status === "rework";
        const isLoading = loading === s.id;

        // Czy poprzedni krok jest ukonczony (lub to pierwszy krok)?
        const prevCompleted = i === 0 || steps[i - 1].status === "completed";
        const canToggle = prevCompleted || isCompleted;

        return (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors",
              isCompleted && "bg-emerald-50/30"
            )}
          >
            {/* Checkbox */}
            <button
              onClick={() => canToggle && toggleStep(s.id, s.status)}
              disabled={!canToggle || isLoading}
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                isCompleted
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : isRework
                    ? "border-red-400 bg-red-50 text-red-500"
                    : canToggle
                      ? "border-zinc-300 hover:border-zinc-400"
                      : "border-zinc-200 bg-zinc-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isCompleted ? (
                <Check size={12} strokeWidth={3} />
              ) : isRework ? (
                <RotateCcw size={10} />
              ) : (
                <Circle size={8} className="text-zinc-300" />
              )}
            </button>

            {/* Nazwa etapu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.step.color }}
                />
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    isCompleted ? "text-zinc-500" : "text-zinc-900"
                  )}
                >
                  {s.step.name}
                </span>
              </div>

              {/* Meta (kto, kiedy, na jakiej maszynie) */}
              {isCompleted && (
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                  {s.completed_by_user && (
                    <span>{s.completed_by_user.full_name}</span>
                  )}
                  {s.machine && <span>na {s.machine.name}</span>}
                  {s.completed_at && (
                    <span>
                      {new Date(s.completed_at).toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Numer kroku */}
            <span className="text-[11px] font-medium text-zinc-300">
              {s.step_order}
            </span>
          </div>
        );
      })}
    </div>
  );
}
