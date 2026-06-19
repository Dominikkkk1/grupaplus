"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Scan, CheckCircle2, AlertTriangle, Loader2, Cog } from "lucide-react";

interface ProgressStep {
  id: string;
  step_order: number;
  status: string;
  step: { name: string; color: string };
}

interface ScannedOrder {
  orderId: string;
  orderNumber: string;
  itemDescription: string;
  itemId: string;
  steps: ProgressStep[];
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);

  const [scanning, setScanning] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<ScannedOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stanowisko operatora
  const [machines, setMachines] = useState<{ id: string; name: string; group: string }[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");

  // Pobierz maszyny przy starcie + odczytaj zapisane stanowisko
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("machines")
      .select("id, name, group:machine_groups(name)")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setMachines(
          (data ?? []).map((m) => ({
            id: m.id,
            name: m.name,
            group: (m.group as unknown as { name: string })?.name ?? "",
          }))
        );
      });
    // Odczytaj zapisane stanowisko z sessionStorage
    const saved = sessionStorage.getItem("scan_machine_id");
    if (saved) setSelectedMachine(saved);
  }, []);

  function changeMachine(id: string) {
    setSelectedMachine(id);
    if (id) sessionStorage.setItem("scan_machine_id", id);
    else sessionStorage.removeItem("scan_machine_id");
  }
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [confirmSkip, setConfirmSkip] = useState<{
    progressId: string;
    stepName: string;
  } | null>(null);

  // Uruchom skaner QR
  async function startScanner() {
    if (scanning) return;
    setScanning(true);

    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrScanned(decodedText);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {} // ignore errors
      );
    } catch {
      setMessage({ type: "error", text: "Nie udalo sie uruchomic kamery" });
      setScanning(false);
    }
  }

  // Przetworz zeskanowany QR
  const handleQrScanned = useCallback(async (url: string) => {
    // Wyciagnij order ID z URL: /orders/UUID
    const match = url.match(/\/orders\/([a-f0-9-]+)/i);
    if (!match) {
      setMessage({ type: "error", text: "Nieprawidlowy kod QR" });
      return;
    }

    const orderId = match[1];
    const supabase = createClient();

    // Pobierz zamowienie z pozycjami i etapami
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("id", orderId)
      .single();

    if (!order) {
      setMessage({ type: "error", text: "Zamowienie nie znalezione" });
      return;
    }

    // Pobierz pierwsza pozycje z etapami (uproszczenie — jedna pozycja per skan)
    const { data: items } = await supabase
      .from("order_items")
      .select(
        "id, description, product:products(name), progress:order_item_progress(id, step_order, status, step:workflow_steps(name, color))"
      )
      .eq("order_id", orderId)
      .eq("is_completed", false)
      .limit(1);

    if (!items || items.length === 0) {
      setMessage({ type: "success", text: "Wszystkie pozycje ukonczone!" });
      return;
    }

    const item = items[0];
    const product = item.product as unknown as { name: string } | null;

    setScannedOrder({
      orderId: order.id,
      orderNumber: order.order_number,
      itemDescription: product?.name ?? item.description,
      itemId: item.id,
      steps: ((item.progress ?? []) as unknown as ProgressStep[]).sort(
        (a, b) => a.step_order - b.step_order
      ),
    });
    setMessage(null);
  }, []);

  // Rozpocznij / zakoncz etap
  async function handleAction(
    progressId: string,
    action: "start" | "complete",
    force = false
  ) {
    setActionLoading(progressId);
    setConfirmSkip(null);

    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        progressId,
        action,
        force,
        machineId: selectedMachine || undefined,
      }),
    });

    const data = await res.json();

    if (res.status === 409 && data.requiresConfirmation) {
      setConfirmSkip({ progressId, stepName: data.stepName });
      setActionLoading(null);
      return;
    }

    if (!res.ok) {
      setMessage({ type: "error", text: data.error });
      setActionLoading(null);
      return;
    }

    setMessage({
      type: "success",
      text:
        action === "start"
          ? `Rozpoczeto: ${data.stepName}`
          : `Ukonczono: ${data.stepName}`,
    });

    // Odswierz dane zamowienia
    if (scannedOrder) {
      handleQrScanned(`/orders/${scannedOrder.orderId}`);
    }
    setActionLoading(null);
  }

  // Cleanup skanera
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        (scannerRef.current as { stop: () => Promise<void> })
          .stop()
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">
          Skanowanie QR
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Zeskanuj kod QR z karty produkcyjnej
        </p>
      </div>

      {/* Stanowisko */}
      <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
          <Cog size={14} />
          Twoje stanowisko
        </label>
        <select
          value={selectedMachine}
          onChange={(e) => changeMachine(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-[14px] font-medium focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          <option value="">— Wybierz maszyne —</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.group ? `(${m.group})` : ""}
            </option>
          ))}
        </select>
        {!selectedMachine && (
          <p className="mt-2 text-[11px] text-amber-600">
            Wybierz maszyne zanim zaczniesz skanowac
          </p>
        )}
      </div>

      {/* Komunikat */}
      {message && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-[13px] ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : message.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Potwierdzenie skip */}
      {confirmSkip && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] font-medium text-amber-800">
            Poprzedni etap ({confirmSkip.stepName}) nie jest ukonczony.
          </p>
          <p className="mt-1 text-[12px] text-amber-600">
            Czy potwierdzasz, ze ta czesc zostala wykonana?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                handleAction(confirmSkip.progressId, "start", true)
              }
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-amber-700"
            >
              Tak, potwierdz
            </button>
            <button
              onClick={() => setConfirmSkip(null)}
              className="rounded-lg border border-amber-300 px-4 py-1.5 text-[12px] font-medium text-amber-700 hover:bg-amber-100"
            >
              Nie, cofnij
            </button>
          </div>
        </div>
      )}

      {/* Skaner */}
      {!scannedOrder && (
        <div className="mb-6">
          <div
            id="qr-reader"
            ref={videoRef}
            className="mb-4 overflow-hidden rounded-lg border border-zinc-200"
          />
          {!scanning && (
            <button
              onClick={startScanner}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-3 text-[13px] font-medium text-white hover:bg-zinc-800"
            >
              <Scan size={16} />
              Uruchom kamere
            </button>
          )}
        </div>
      )}

      {/* Zeskanowane zamowienie */}
      {scannedOrder && (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="font-mono text-[14px] font-semibold text-zinc-900">
              {scannedOrder.orderNumber}
            </p>
            <p className="mt-0.5 text-[13px] text-zinc-600">
              {scannedOrder.itemDescription}
            </p>
          </div>

          <div className="p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Etapy produkcji
            </p>
            <div className="space-y-2">
              {scannedOrder.steps.map((step) => {
                const isCompleted = step.status === "completed";
                const isInProgress = step.status === "in_progress";
                const isPending = step.status === "pending";
                const isLoading = actionLoading === step.id;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      isCompleted
                        ? "border-emerald-200 bg-emerald-50"
                        : isInProgress
                          ? "border-blue-200 bg-blue-50"
                          : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: (step.step as { color: string })
                            ?.color,
                        }}
                      />
                      <span className="text-[13px] font-medium text-zinc-900">
                        {step.step_order}.{" "}
                        {(step.step as { name: string })?.name}
                      </span>
                    </div>

                    {isCompleted && (
                      <CheckCircle2
                        size={18}
                        className="text-emerald-500"
                      />
                    )}
                    {isInProgress && (
                      <button
                        onClick={() => handleAction(step.id, "complete")}
                        disabled={isLoading}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Zakoncz"
                        )}
                      </button>
                    )}
                    {isPending && (
                      <button
                        onClick={() => handleAction(step.id, "start")}
                        disabled={isLoading}
                        className="rounded-lg bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Rozpocznij"
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-zinc-100 px-5 py-3">
            <button
              onClick={() => {
                setScannedOrder(null);
                setMessage(null);
              }}
              className="w-full rounded-lg border border-zinc-200 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Skanuj kolejna karte
            </button>
          </div>
        </div>
      )}

      {/* Link do skanera recznego */}
      <div className="mt-4 text-center">
        <p className="text-[11px] text-zinc-400">
          Lub wpisz numer zamowienia recznie:
        </p>
        <input
          type="text"
          placeholder="GP-260619-0001"
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-center font-mono text-[13px] placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const input = e.currentTarget.value.trim();
              if (input) {
                // Szukaj po order_number
                const supabase = createClient();
                supabase
                  .from("orders")
                  .select("id")
                  .eq("order_number", input)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (data) {
                      handleQrScanned(`/orders/${data.id}`);
                    } else {
                      setMessage({
                        type: "error",
                        text: "Zamowienie nie znalezione",
                      });
                    }
                  });
              }
            }
          }}
        />
      </div>
    </div>
  );
}
