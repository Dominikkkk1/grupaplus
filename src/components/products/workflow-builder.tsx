"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
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
  const [justSaved, setJustSaved] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

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

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newArr = [...assigned];
    const [dragged] = newArr.splice(dragItem.current, 1);
    newArr.splice(dragOverItem.current, 0, dragged);
    setAssigned(newArr.map((a, i) => ({ ...a, stepOrder: i + 1 })));
    setSaved(false);
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
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
      setError(data.error || "Błąd zapisu");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
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
          className={justSaved ? "bg-emerald-600 text-[12px] text-white" : "bg-zinc-900 text-[12px] text-white hover:bg-zinc-800"}
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Zapisywanie...
            </span>
          ) : justSaved ? (
            <span className="flex items-center gap-1.5">
              &#10003; Zapisano!
            </span>
          ) : saved ? (
            "Zapisano"
          ) : (
            <span className="flex items-center gap-1.5">
              <Save size={12} />
              Zapisz etapy
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
        <div className="mb-6 space-y-0">
          {assigned.map((step, i) => {
            const isDragging = draggingIndex === i;
            const isOver = dragOverIndex === i && draggingIndex !== i;
            return (
              <div key={step.stepId}>
                {/* Drop indicator — linia nad elementem */}
                {isOver && draggingIndex !== null && draggingIndex > i && (
                  <div className="mx-2 h-0.5 rounded bg-blue-500 transition-all" />
                )}
                <div
                  draggable
                  onDragStart={() => { dragItem.current = i; setDraggingIndex(i); }}
                  onDragEnter={() => { dragOverItem.current = i; setDragOverIndex(i); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  className={`my-0.5 flex cursor-grab items-center gap-3 rounded-lg border px-4 py-2.5 shadow-sm transition-all ${
                    isDragging
                      ? "border-blue-300 bg-blue-50 opacity-50"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <GripVertical size={14} className="flex-shrink-0 text-zinc-300" />
                  <span className="w-5 text-center text-[12px] font-semibold text-zinc-400">
                    {step.stepOrder}
                  </span>
                  <div
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: step.color }}
                  />
                  <span className="flex-1 text-[13px] font-medium text-zinc-900">
                    {step.name}
                  </span>
                  <button
                    onClick={() => removeStep(step.stepId)}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    title="Usuń"
                  >
                    <X size={14} />
                  </button>
                </div>
                {/* Drop indicator — linia pod elementem */}
                {isOver && draggingIndex !== null && draggingIndex < i && (
                  <div className="mx-2 h-0.5 rounded bg-blue-500 transition-all" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
          <p className="text-[13px] text-zinc-500">
            Brak etapów — dodaj z listy poniżej
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
