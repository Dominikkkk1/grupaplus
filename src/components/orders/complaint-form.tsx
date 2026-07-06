"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderItem {
  id: string;
  description: string;
  progress: { step_id: string; step_order: number; step: { name: string } }[];
}

export function ComplaintForm({
  orderId,
  items,
  onClose,
}: {
  orderId: string;
  items: OrderItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState<"internal" | "external">("internal");
  const [orderItemId, setOrderItemId] = useState("");
  const [revertToStepId, setRevertToStepId] = useState("");
  const [reprintQuantity, setReprintQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Etapy wybranej pozycji
  const selectedItem = items.find((i) => i.id === orderItemId);
  const availableSteps = selectedItem?.progress
    ?.sort((a, b) => a.step_order - b.step_order) ?? [];

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

    const res = await fetch(`/api/orders/${orderId}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        orderItemId: orderItemId || undefined,
        reason,
        revertToStepId: revertToStepId || undefined,
        reprintQuantity: reprintQuantity
          ? parseInt(reprintQuantity)
          : undefined,
        notes,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Błąd zapisu");
      setLoading(false);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[15px] font-semibold text-zinc-900">
            Nowe zgłoszenie
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Typ */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-zinc-600">
              Typ zgłoszenia
            </label>
            <div className="flex gap-3">
              {[
                { value: "internal", label: "Wewnetrzne (produkcja)" },
                { value: "external", label: "Zewnetrzne (klient)" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                    type === opt.value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={opt.value}
                    checked={type === opt.value}
                    onChange={() =>
                      setType(opt.value as "internal" | "external")
                    }
                    className="hidden"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Pozycja (opcjonalnie) */}
          {type === "internal" && items.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Dotyczy pozycji
              </label>
              <select
                value={orderItemId}
                onChange={(e) => {
                  setOrderItemId(e.target.value);
                  setRevertToStepId("");
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">— Wybierz pozycje —</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cofnij do etapu */}
          {type === "internal" && orderItemId && availableSteps.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Cofnij do etapu
              </label>
              <select
                value={revertToStepId}
                onChange={(e) => setRevertToStepId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">— Bez cofania —</option>
                {availableSteps.map((s) => (
                  <option key={s.step_id} value={s.step_id}>
                    {s.step_order}. {s.step?.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ilosc dodruku */}
          {type === "internal" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Ilosc dodruku (opcjonalnie)
              </label>
              <input
                type="number"
                min={1}
                value={reprintQuantity}
                onChange={(e) => setReprintQuantity(e.target.value)}
                placeholder="np. 10"
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          )}

          {/* Powód */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Powód zgłoszenia *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
              placeholder="Opisz co poszlo nie tak..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          {/* Notatki */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
              Notatki (opcjonalnie)
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
                "Zgłoś incydent"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
