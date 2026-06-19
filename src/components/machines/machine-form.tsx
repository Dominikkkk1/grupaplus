"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MachineData {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  notes: string | null;
}

export function MachineForm({
  machine,
  groupId,
  onClose,
}: {
  machine?: MachineData;
  groupId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!machine;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(machine?.name ?? "");
  const [priority, setPriority] = useState(machine?.priority?.toString() ?? "0");
  const [isActive, setIsActive] = useState(machine?.is_active ?? true);
  const [notes, setNotes] = useState(machine?.notes ?? "");

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

    const url = isEdit ? `/api/machines/${machine.id}` : "/api/machines";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        groupId,
        priority: parseInt(priority) || 0,
        isActive: isActive,
        notes,
      }),
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
            {isEdit ? "Edytuj maszyne" : "Nowa maszyna"}
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
              Nazwa maszyny *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="np. Fuji Revoria"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Priorytet (0-100, wyzszy = wazniejszy)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <label className="flex items-center gap-2 text-[13px] text-zinc-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Maszyna aktywna
          </label>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Notatki
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="Dodatkowe informacje..."
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-[13px]">
              Anuluj
            </Button>
            <Button type="submit" disabled={loading} className="bg-zinc-900 text-[13px] text-white hover:bg-zinc-800">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Zapisywanie...
                </span>
              ) : isEdit ? "Zapisz" : "Dodaj maszyne"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
