"use client";

import { useState } from "react";
import { Check, MessageSquareWarning, Loader2 } from "lucide-react";

/**
 * Dwa przyciski dla klienta: akceptacja projektu albo prosba o poprawki.
 * Zadnego logowania — cala autoryzacja siedzi w tokenie z linku.
 */
export function ApprovalDecision({ token }: { token: string }) {
  const [loading, setLoading] = useState<"approved" | "changes_requested" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "changes_requested") {
    setError("");
    setLoading(decision);
    try {
      const res = await fetch(`/api/approval/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Coś poszło nie tak. Prosimy spróbować ponownie.");
        setLoading(null);
        return;
      }
      setDone(decision);
    } catch {
      setError("Brak połączenia. Prosimy spróbować ponownie.");
    }
    setLoading(null);
  }

  if (done === "approved") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <Check size={28} className="mx-auto text-emerald-600" />
        <h2 className="mt-2 text-[16px] font-semibold text-emerald-900">
          Dziękujemy za akceptację
        </h2>
        <p className="mt-1 text-[14px] text-emerald-800">
          Przekazujemy zamówienie do produkcji.
        </p>
      </div>
    );
  }

  if (done === "changes_requested") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <MessageSquareWarning size={28} className="mx-auto text-amber-600" />
        <h2 className="mt-2 text-[16px] font-semibold text-amber-900">
          Uwagi zapisane
        </h2>
        <p className="mt-1 text-[14px] text-amber-800">
          Przekazaliśmy je grafikowi. Poprawiona wersja trafi do Państwa mailem.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}

      {!showComment ? (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={() => decide("approved")}
            disabled={loading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading === "approved" ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
            Akceptuję projekt
          </button>
          <button
            onClick={() => setShowComment(true)}
            disabled={loading !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-5 py-3.5 text-[15px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
          >
            <MessageSquareWarning size={17} />
            Proszę o poprawki
          </button>
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-700">
            Co poprawić? (opcjonalnie, ale bardzo pomaga)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Np. proszę zmienić kolor tła na ciemniejszy, literówka w adresie..."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-[14px] placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={() => decide("changes_requested")}
              disabled={loading !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              {loading === "changes_requested" ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <MessageSquareWarning size={17} />
              )}
              Wyślij uwagi
            </button>
            <button
              onClick={() => setShowComment(false)}
              disabled={loading !== null}
              className="rounded-lg border border-zinc-300 px-5 py-3 text-[14px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Wróć
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
