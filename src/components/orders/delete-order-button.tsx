"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={12} />
        Usuń zamówienie
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-semibold text-zinc-900">
              Usunąć zamówienie?
            </h3>
            <p className="mt-2 text-[13px] text-zinc-500">
              To usunie zamówienie wraz ze wszystkimi pozycjami, etapami, plikami
              i zgłoszeniami. Tej operacji nie można cofnąć.
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Wpisz USUŃ aby potwierdzić
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="USUŃ"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setInput("");
                }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Anuluj
              </button>
              <button
                disabled={input !== "USUŃ" || loading}
                onClick={async () => {
                  setLoading(true);
                  const res = await fetch(`/api/orders/${orderId}`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    router.push("/orders");
                  } else {
                    setLoading(false);
                    setInput("");
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Usuwanie..." : "Usuń zamówienie"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
