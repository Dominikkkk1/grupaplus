"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  X,
  Plus,
  Save,
  Loader2,
  GitFork,
  GitMerge,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  id: string;
  name: string;
  color: string;
}

type BranchType = "common" | "branch_a" | "branch_b";

interface AssignedStep {
  stepId: string;
  stepOrder: number;
  name: string;
  color: string;
  branchType: BranchType;
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
  const hasBranches = initialWorkflow.some((s) => s.branchType !== "common");
  const [isForkMode, setIsForkMode] = useState(hasBranches);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(true);
  const [justSaved, setJustSaved] = useState(false);

  // Rozdzielone listy per sekcja
  const [preFork, setPreFork] = useState<AssignedStep[]>(
    initialWorkflow.filter((s) => s.branchType === "common" && (!hasBranches || s.stepOrder <= getLastPreForkOrder(initialWorkflow)))
  );
  const [branchA, setBranchA] = useState<AssignedStep[]>(
    initialWorkflow.filter((s) => s.branchType === "branch_a")
  );
  const [branchB, setBranchB] = useState<AssignedStep[]>(
    initialWorkflow.filter((s) => s.branchType === "branch_b")
  );
  const [postJoin, setPostJoin] = useState<AssignedStep[]>(
    initialWorkflow.filter((s) => s.branchType === "common" && hasBranches && s.stepOrder > getLastPreForkOrder(initialWorkflow))
  );

  // Dla liniowego trybu — flat lista
  const [linearSteps, setLinearSteps] = useState<AssignedStep[]>(
    hasBranches ? [] : initialWorkflow
  );

  // Wszystkie przypisane stepy (do filtrowania available)
  const allAssigned = isForkMode
    ? [...preFork, ...branchA, ...branchB, ...postJoin]
    : linearSteps;
  const linearAssignedIds = new Set(linearSteps.map((a) => a.stepId));
  const preForkIds = new Set(preFork.map((a) => a.stepId));
  const postJoinIds = new Set(postJoin.map((a) => a.stepId));
  // Linear: filtruj przypisane. Fork preFork/postJoin: filtruj. Branche: nie filtruj (ten sam step moze byc w A i B)
  const availableLinear = allSteps.filter((s) => !linearAssignedIds.has(s.id));
  const availablePreFork = allSteps.filter((s) => !preForkIds.has(s.id));
  const availablePostJoin = allSteps.filter((s) => !postJoinIds.has(s.id));
  const availableBranch = allSteps; // ten sam step moze byc w obu branchach

  function renumber(steps: AssignedStep[]): AssignedStep[] {
    return steps.map((s, i) => ({ ...s, stepOrder: i + 1 }));
  }

  function addToSection(step: Step, section: string) {
    const newStep = (branch: BranchType): AssignedStep => ({
      stepId: step.id,
      stepOrder: 0, // renumber later
      name: step.name,
      color: step.color,
      branchType: branch,
    });

    if (section === "preFork") {
      setPreFork((prev) => renumber([...prev, newStep("common")]));
    } else if (section === "branchA") {
      setBranchA((prev) => renumber([...prev, newStep("branch_a")]));
    } else if (section === "branchB") {
      setBranchB((prev) => renumber([...prev, newStep("branch_b")]));
    } else if (section === "postJoin") {
      setPostJoin((prev) => renumber([...prev, newStep("common")]));
    } else {
      setLinearSteps((prev) => renumber([...prev, newStep("common")]));
    }
    setSaved(false);
  }

  function removeFromSection(stepId: string, section: string) {
    const setter = section === "preFork" ? setPreFork
      : section === "branchA" ? setBranchA
      : section === "branchB" ? setBranchB
      : section === "postJoin" ? setPostJoin
      : setLinearSteps;
    setter((prev) => renumber(prev.filter((s) => s.stepId !== stepId)));
    setSaved(false);
  }

  function handleDrag(section: string, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const setter = section === "preFork" ? setPreFork
      : section === "branchA" ? setBranchA
      : section === "branchB" ? setBranchB
      : section === "postJoin" ? setPostJoin
      : setLinearSteps;
    setter((prev) => {
      const arr = [...prev];
      const [dragged] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragged);
      return renumber(arr);
    });
    setSaved(false);
  }

  function toggleForkMode() {
    if (isForkMode) {
      // Fork → Linear: merge all into linear
      setLinearSteps(renumber([...preFork, ...branchA, ...branchB, ...postJoin].map((s) => ({ ...s, branchType: "common" as BranchType }))));
      setPreFork([]);
      setBranchA([]);
      setBranchB([]);
      setPostJoin([]);
    } else {
      // Linear → Fork: move all to preFork, empty branches
      setPreFork(renumber(linearSteps.map((s) => ({ ...s, branchType: "common" as BranchType }))));
      setBranchA([]);
      setBranchB([]);
      setPostJoin([]);
      setLinearSteps([]);
    }
    setIsForkMode(!isForkMode);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    // Walidacja fork
    if (isForkMode && (branchA.length === 0 || branchB.length === 0)) {
      setError("Fork wymaga przynajmniej 1 krok w każdym branchu (A i B)");
      setSaving(false);
      return;
    }

    // Dla post-join: step_order = 100+ zeby rozroznic od pre-fork common
    const stepsWithOrder = isForkMode
      ? [
          ...preFork.map((s) => ({ stepId: s.stepId, stepOrder: s.stepOrder, branchType: "common" as const })),
          ...branchA.map((s) => ({ stepId: s.stepId, stepOrder: s.stepOrder, branchType: "branch_a" as const })),
          ...branchB.map((s) => ({ stepId: s.stepId, stepOrder: s.stepOrder, branchType: "branch_b" as const })),
          ...postJoin.map((s, i) => ({ stepId: s.stepId, stepOrder: 100 + i + 1, branchType: "common" as const })),
        ]
      : linearSteps.map((s) => ({ stepId: s.stepId, stepOrder: s.stepOrder, branchType: "common" as const }));

    const res = await fetch(`/api/products/${productId}/workflow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: stepsWithOrder }),
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
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
          Etapy produkcji ({allAssigned.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={toggleForkMode}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isForkMode
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
          >
            <GitFork size={13} />
            {isForkMode ? "Fork/Join" : "Liniowy"}
          </button>
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
            ) : justSaved ? "✓ Zapisano!" : saved ? "Zapisano" : (
              <span className="flex items-center gap-1.5">
                <Save size={12} />
                Zapisz
              </span>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {isForkMode ? (
        /* ==================== FORK/JOIN MODE ==================== */
        <div className="space-y-4">
          {/* Pre-fork common */}
          <StepSection
            label="Wspólne (przed forkiem)"
            steps={preFork}
            section="preFork"
            allSteps={availablePreFork}
            onAdd={(step) => addToSection(step, "preFork")}
            onRemove={(id) => removeFromSection(id, "preFork")}
            onDrag={(from, to) => handleDrag("preFork", from, to)}
          />

          {/* Fork marker */}
          <div className="flex items-center gap-2 px-4">
            <div className="h-px flex-1 bg-purple-300" />
            <span className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-[11px] font-semibold text-purple-700">
              <GitFork size={12} />
              FORK
            </span>
            <div className="h-px flex-1 bg-purple-300" />
          </div>

          {/* Branches side by side */}
          <div className="grid grid-cols-2 gap-3">
            <StepSection
              label="Branch A (Okładka)"
              steps={branchA}
              section="branchA"
              allSteps={availableBranch}
              onAdd={(step) => addToSection(step, "branchA")}
              onRemove={(id) => removeFromSection(id, "branchA")}
              onDrag={(from, to) => handleDrag("branchA", from, to)}
              accent="blue"
            />
            <StepSection
              label="Branch B (Wkład)"
              steps={branchB}
              section="branchB"
              allSteps={availableBranch}
              onAdd={(step) => addToSection(step, "branchB")}
              onRemove={(id) => removeFromSection(id, "branchB")}
              onDrag={(from, to) => handleDrag("branchB", from, to)}
              accent="emerald"
            />
          </div>

          {/* Join marker */}
          <div className="flex items-center gap-2 px-4">
            <div className="h-px flex-1 bg-purple-300" />
            <span className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-[11px] font-semibold text-purple-700">
              <GitMerge size={12} />
              JOIN
            </span>
            <div className="h-px flex-1 bg-purple-300" />
          </div>

          {/* Post-join common */}
          <StepSection
            label="Wspólne (po joinie)"
            steps={postJoin}
            section="postJoin"
            allSteps={availablePostJoin}
            onAdd={(step) => addToSection(step, "postJoin")}
            onRemove={(id) => removeFromSection(id, "postJoin")}
            onDrag={(from, to) => handleDrag("postJoin", from, to)}
          />
        </div>
      ) : (
        /* ==================== LINEAR MODE ==================== */
        <StepSection
          label=""
          steps={linearSteps}
          section="linear"
          allSteps={availableLinear}
          onAdd={(step) => addToSection(step, "linear")}
          onRemove={(id) => removeFromSection(id, "linear")}
          onDrag={(from, to) => handleDrag("linear", from, to)}
        />
      )}
    </div>
  );
}

/* Helper: find last pre-fork step_order */
function getLastPreForkOrder(steps: AssignedStep[]): number {
  const hasBranch = steps.some((s) => s.branchType !== "common");
  if (!hasBranch) return Infinity;
  // Pre-fork = common steps with step_order < 100 (convention: post-join = 100+)
  const commonSteps = steps.filter((s) => s.branchType === "common");
  const preForkSteps = commonSteps.filter((s) => s.stepOrder < 100);
  return preForkSteps.length > 0 ? Math.max(...preForkSteps.map((s) => s.stepOrder)) : 0;
}

/* ==================== Reusable Section Component ==================== */
function StepSection({
  label,
  steps,
  section,
  allSteps,
  onAdd,
  onRemove,
  onDrag,
  accent,
}: {
  label: string;
  steps: AssignedStep[];
  section: string;
  allSteps: Step[];
  onAdd: (step: Step) => void;
  onRemove: (stepId: string) => void;
  onDrag: (fromIdx: number, toIdx: number) => void;
  accent?: "blue" | "emerald";
}) {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragEnd() {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      onDrag(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  const borderColor = accent === "blue" ? "border-blue-200" : accent === "emerald" ? "border-emerald-200" : "border-zinc-200";
  const bgColor = accent === "blue" ? "bg-blue-50/30" : accent === "emerald" ? "bg-emerald-50/30" : "";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      {label && (
        <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${
          accent === "blue" ? "text-blue-600" : accent === "emerald" ? "text-emerald-600" : "text-zinc-500"
        }`}>
          {label}
        </p>
      )}

      {steps.length > 0 ? (
        <div className="space-y-0">
          {steps.map((step, i) => {
            const isDragging = draggingIdx === i;
            const isOver = dragOverIdx === i && draggingIdx !== i;
            return (
              <div key={`${step.stepId}-${section}`}>
                {isOver && draggingIdx !== null && draggingIdx > i && (
                  <div className="mx-1 h-0.5 rounded bg-blue-500" />
                )}
                <div
                  draggable
                  onDragStart={() => { dragItem.current = i; setDraggingIdx(i); }}
                  onDragEnter={() => { dragOverItem.current = i; setDragOverIdx(i); }}
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
                  <button onClick={() => onRemove(step.stepId)} className="rounded p-0.5 text-zinc-400 hover:text-red-500">
                    <X size={12} />
                  </button>
                </div>
                {isOver && draggingIdx !== null && draggingIdx < i && (
                  <div className="mx-1 h-0.5 rounded bg-blue-500" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-[11px] text-zinc-400">
          Brak — dodaj krok poniżej
        </div>
      )}

      {/* Dostępne etapy */}
      <div className="mt-2 flex flex-wrap gap-1">
        {allSteps.map((step) => (
          <button
            key={`${step.id}-${section}`}
            onClick={() => onAdd(step)}
            className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
          >
            <Plus size={10} />
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: step.color }} />
            {step.name}
          </button>
        ))}
      </div>
    </div>
  );
}
