"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ERROR BOUNDARY]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-xl font-semibold text-gray-900">
          Coś poszło nie tak
        </h2>
        <p className="text-sm text-gray-500">
          {error.message || "Wystąpił nieoczekiwany błąd."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}
