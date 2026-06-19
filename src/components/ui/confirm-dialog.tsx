"use client";

import { useEffect, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Usun",
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    },
    [onCancel, loading]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
            <p className="mt-1 text-[13px] text-zinc-500">{message}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="text-[13px]"
          >
            Anuluj
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="whitespace-nowrap bg-red-600 px-4 py-2 text-[13px] text-white hover:bg-red-700"
          >
            {loading ? "Usuwanie..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
