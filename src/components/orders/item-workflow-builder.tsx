"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, X, Plus, Save, Loader2 } from "lucide-react";
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

export function ItemWorkflowBuilder({
  orderId,
  orderItemId,
  allSteps,
}: {
  orderId: string;
  orderItemId: string;
  allSteps: Step[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<AssignedStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const assignedIds = new Set(assigned.map((a) => a.stepId));
  const available = allSteps.filter((s) => !assignedIds.has(s.id));

  function addStep(step: Step) {
    const maxOrder = assigned.length > 0 ? Math.max(...assigned.map((a) => a.stepOrder)) : 0;
    setAssigned([...assigned, { stepId: step.id, stepOrder: maxOrder + 1, name: step.name, color: step.color }]);
    setSaved(false);
  }

  function removeStep(stepId: string) {
    setAssigned(assigned.filter((a) => a.stepId !== stepId).map((a, i) => ({ ...a, stepOrder: i + 1 })));
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
    if (assigned.length === 0) {
      setError("Dodaj przynajmniej jeden etap");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch(`/api/orders/${orderId}/items/${orderItemId}/workflow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: assigned.map((a) => ({ stepId: a.stepId, stepOrder: a.stepOrder })),
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
    router.refresh();
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-amber-600">
          Ustaw marszrutę produkcyjną
        </p>
        {assigned.length > 0 && (
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
                Zapisz marszrutę
              </span>
            )}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {assigned.length > 0 && (
        <div className="mb-3 space-y-0">
          {assigned.map((step, i) => {
            const isDragging = draggingIndex === i;
            const isOver = dragOverIndex === i && draggingIndex !== i;
            return (
              <div key={step.stepId}>
                {isOver && draggingIndex !== null && draggingIndex > i && (
                  <div className="mx-1 h-0.5 rounded bg-blue-500" />
                )}
                <div
                  draggable
                  onDragStart={() => { dragItem.current = i; setDraggingIndex(i); }}
                  onDragEnter={() => { dragOverItem.current = i; setDragOverIndex(i); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  className={`my-0.5 flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 text-[12px] shadow-sm transition-all ${
                    isDragging ? "border-blue-300 bg-blue-50 opacity-50" : "border-zinc-200 bg-white"
                  }`}
                >
                  <GripVertical size={12} className="text-zinc-300" />
                  <span className="w-4 text-center text-[11px] font-semibold text-zinc-400">{step.stepOrder}</span>
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: step.color }} />
                  <span className="flex-1 font-medium text-zinc-900">{step.name}</span>
                  <button onClick={() => removeStep(step.stepId)} className="rounded p-0.5 text-zinc-400 hover:text-red-500">
                    <X size={12} />
                  </button>
                </div>
                {isOver && draggingIndex !== null && draggingIndex < i && (
                  <div className="mx-1 h-0.5 rounded bg-blue-500" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((step) => (
            <button
              key={step.id}
              onClick={() => addStep(step)}
              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            >
              <Plus size={10} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: step.color }} />
              {step.name}
            </button>
          ))}
        </div>
      )}

      {assigned.length === 0 && available.length === 0 && (
        <p className="text-[12px] text-zinc-400">Brak dostępnych etapów</p>
      )}
    </div>
  );
}
