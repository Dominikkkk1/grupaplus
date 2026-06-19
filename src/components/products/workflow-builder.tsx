"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  id: string;
  name: string;
  color: string;
}

interface AssignedStep {
  stepId: string;
  stepOrder: number;
  name: string;
  color: string;
}

export function WorkflowBuilder({
  productId,
  allSteps,
  initialWorkflow,
}: {
  productId: string;
  allSteps: Step[];
  initialWorkflow: AssignedStep[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<AssignedStep[]>(initialWorkflow);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);

  // Etapy dostepne = te ktore NIE sa jeszcze przypisane
  const assignedIds = new Set(assigned.map((a) => a.stepId));
  const available = allSteps.filter((s) => !assignedIds.has(s.id));

  function addStep(step: Step) {
    const maxOrder =
      assigned.length > 0
        ? Math.max(...assigned.map((a) => a.stepOrder))
        : 0;
    setAssigned([
      ...assigned,
      {
        stepId: step.id,
        stepOrder: maxOrder + 1,
        name: step.name,
        color: step.color,
      },
    ]);
    setSaved(false);
  }

  function removeStep(stepId: string) {
    const filtered = assigned.filter((a) => a.stepId !== stepId);
    // Przenumeruj stepOrder
    setAssigned(
      filtered.map((a, i) => ({ ...a, stepOrder: i + 1 }))
    );
    setSaved(false);
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const newArr = [...assigned];
    [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
    setAssigned(
      newArr.map((a, i) => ({ ...a, stepOrder: i + 1 }))
    );
    setSaved(false);
  }

  function moveDown(index: number) {
    if (index >= assigned.length - 1) return;
    const newArr = [...assigned];
    [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
    setAssigned(
      newArr.map((a, i) => ({ ...a, stepOrder: i + 1 }))
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const res = await fetch(`/api/products/${productId}/workflow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: assigned.map((a) => ({
          stepId: a.stepId,
          stepOrder: a.stepOrder,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Blad zapisu");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      {/* Przypisane etapy */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
          Etapy produkcji ({assigned.length})
        </h2>
        <Button
          onClick={handleSave}
          disabled={saving || saved}
          size="sm"
          className="bg-zinc-900 text-[12px] text-white hover:bg-zinc-800"
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Zapisywanie...
            </span>
          ) : saved ? (
            "Zapisano"
          ) : (
            <span className="flex items-center gap-1.5">
              <Save size={12} />
              Zapisz workflow
            </span>
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {assigned.length > 0 ? (
        <div className="mb-6 space-y-1.5">
          {assigned.map((step, i) => (
            <div
              key={step.stepId}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 shadow-sm"
            >
              <span className="w-5 text-center text-[12px] font-semibold text-zinc-400">
                {step.stepOrder}
              </span>
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: step.color }}
              />
              <span className="flex-1 text-[13px] font-medium text-zinc-900">
                {step.name}
              </span>
              <div className="flex gap-0.5">
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30"
                  title="W gore"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === assigned.length - 1}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30"
                  title="W dol"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => removeStep(step.stepId)}
                  className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  title="Usun"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
          <p className="text-[13px] text-zinc-500">
            Brak etapow — dodaj z listy ponizej
          </p>
        </div>
      )}

      {/* Dostepne etapy */}
      {available.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-medium text-zinc-500">
            Dostepne etapy (kliknij aby dodac):
          </p>
          <div className="flex flex-wrap gap-2">
            {available.map((step) => (
              <button
                key={step.id}
                onClick={() => addStep(step)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <Plus size={12} />
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: step.color }}
                />
                {step.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
