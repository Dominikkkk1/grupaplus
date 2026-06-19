"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLOR_PRESETS = [
  { label: "Niebieski", value: "#3b82f6" },
  { label: "Fioletowy", value: "#8b5cf6" },
  { label: "Zielony", value: "#22c55e" },
  { label: "Bursztyn", value: "#f59e0b" },
  { label: "Pomaranczowy", value: "#f97316" },
  { label: "Rozowy", value: "#ec4899" },
  { label: "Turkus", value: "#14b8a6" },
  { label: "Czerwony", value: "#ef4444" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Szary", value: "#6b7280" },
];

interface MachineGroup {
  id: string;
  name: string;
}

export function WorkflowStepForm({
  machineGroups,
  onClose,
}: {
  machineGroups: MachineGroup[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [machineGroupId, setMachineGroupId] = useState("");

  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/workflow-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, machineGroupId: machineGroupId || null }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Blad zapisu");
      setLoading(false);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[15px] font-semibold text-zinc-900">
            Nowy etap workflow
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Nazwa etapu *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="np. Foliowanie"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Kolor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-7 w-7 rounded-full border-2 ${
                    color === c.value
                      ? "border-zinc-900 ring-2 ring-zinc-300"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Grupa maszyn (opcjonalnie)
            </label>
            <select
              value={machineGroupId}
              onChange={(e) => setMachineGroupId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">— Brak —</option>
              {machineGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-[13px]"
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 text-[13px] text-white hover:bg-zinc-800"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Zapisywanie...
                </span>
              ) : (
                "Dodaj etap"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
