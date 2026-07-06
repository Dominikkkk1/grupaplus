"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanyData {
  id: string;
  name: string;
  nip: string | null;
  address: string | null;
  notes: string | null;
}

export function CompanyForm({
  company,
  onClose,
}: {
  company?: CompanyData;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!company;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(company?.name ?? "");
  const [nip, setNip] = useState(company?.nip ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [notes, setNotes] = useState(company?.notes ?? "");

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

    const url = isEdit ? `/api/companies/${company.id}` : "/api/companies";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nip, address, notes }),
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
            {isEdit ? "Edytuj firme" : "Nowa firma"}
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
              Nazwa firmy *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="np. Autosan S.A."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                NIP
              </label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="1234567890"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-zinc-600">
                Adres
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ul. Lipinskiego 1, Sanok"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[13px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

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
              ) : isEdit ? (
                "Zapisz zmiany"
              ) : (
                "Dodaj firme"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
