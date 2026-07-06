"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Scan, CheckCircle2, AlertTriangle, Loader2, Cog, Download, FileText, Image as ImageIcon } from "lucide-react";

interface ProgressStep {
  id: string;
  step_order: number;
  status: string;
  step: { name: string; color: string; machine_group_id: string | null };
}

interface ItemFile {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
}

interface ScannedOrder {
  orderId: string;
  orderNumber: string;
  itemDescription: string;
  itemId: string;
  steps: ProgressStep[];
  files: ItemFile[];
}

interface MachineGroup {
  id: string;
  name: string;
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);

  const [scanning, setScanning] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<ScannedOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stanowiska operatora (multi-select grup)
  const [machineGroups, setMachineGroups] = useState<MachineGroup[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string; group: string; groupId: string }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");

  // Pobierz grupy maszyn + maszyny przy starcie
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("machine_groups").select("id, name").order("name"),
      supabase
        .from("machines")
        .select("id, name, group_id, group:machine_groups(name)")
        .eq("is_active", true)
        .order("name"),
    ]).then(([groupsRes, machinesRes]) => {
      setMachineGroups((groupsRes.data ?? []) as MachineGroup[]);
      setMachines(
        (machinesRes.data ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          groupId: (m as unknown as { group_id: string }).group_id ?? "",
          group: (m.group as unknown as { name: string })?.name ?? "",
        }))
      );
    });
    // Odczytaj zapisane stanowiska z sessionStorage
    try {
      const savedGroups = sessionStorage.getItem("scan_group_ids");
      if (savedGroups) setSelectedGroupIds(JSON.parse(savedGroups));
      const savedMachine = sessionStorage.getItem("scan_machine_id");
      if (savedMachine) setSelectedMachine(savedMachine);
    } catch {}
  }, []);

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) => {
      const next = prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId];
      sessionStorage.setItem("scan_group_ids", JSON.stringify(next));
      // Jesli wybrana maszyna nie jest w nowych grupach — wyczysc
      const machineInGroups = machines.find((m) => m.id === selectedMachine);
      if (machineInGroups && !next.includes(machineInGroups.groupId)) {
        setSelectedMachine("");
        sessionStorage.removeItem("scan_machine_id");
      }
      return next;
    });
  }

  function changeMachine(id: string) {
    setSelectedMachine(id);
    if (id) sessionStorage.setItem("scan_machine_id", id);
    else sessionStorage.removeItem("scan_machine_id");
  }

  // Maszyny filtrowane po wybranych grupach
  const filteredMachines = selectedGroupIds.length > 0
    ? machines.filter((m) => selectedGroupIds.includes(m.groupId))
    : machines;

  // Nazwy wybranych grup (do ostrzezenia)
  const selectedGroupNames = machineGroups
    .filter((g) => selectedGroupIds.includes(g.id))
    .map((g) => g.name);

  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
    nextStep?: { name: string; group: string | null } | null;
    allDone?: boolean;
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
        () => {}
      );
    } catch {
      setMessage({ type: "error", text: "Nie udało się uruchomić kamery" });
      setScanning(false);
    }
  }

  // Przetworz zeskanowany QR
  const handleQrScanned = useCallback(async (url: string, keepMessage = false) => {
    const match = url.match(/\/orders\/([a-f0-9-]+)/i);
    if (!match) {
      setMessage({ type: "error", text: "Nieprawidłowy kod QR" });
      return;
    }

    const orderId = match[1];
    const supabase = createClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("id", orderId)
      .single();

    if (!order) {
      setMessage({ type: "error", text: "Zamówienie nie znalezione" });
      return;
    }

    const { data: items } = await supabase
      .from("order_items")
      .select(
        "id, description, product:products(name), progress:order_item_progress(id, step_order, status, step:workflow_steps(name, color, machine_group_id))"
      )
      .eq("order_id", orderId)
      .eq("is_completed", false)
      .limit(1);

    if (!items || items.length === 0) {
      setMessage({ type: "success", text: "Wszystkie pozycje ukończone!" });
      return;
    }

    const item = items[0];
    const product = item.product as unknown as { name: string } | null;

    // Pobierz pliki: przypisane do pozycji + ogolne zamowienia
    const [{ data: itemFiles }, { data: orderFiles }] = await Promise.all([
      supabase
        .from("order_files")
        .select("id, file_name, file_size, mime_type, file_path")
        .eq("order_item_id", item.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_files")
        .select("id, file_name, file_size, mime_type, file_path")
        .eq("order_id", orderId)
        .is("order_item_id", null)
        .order("created_at", { ascending: false }),
    ]);
    const allFiles = [...(itemFiles ?? []), ...(orderFiles ?? [])];

    setScannedOrder({
      orderId: order.id,
      orderNumber: order.order_number,
      itemDescription: product?.name ?? item.description,
      itemId: item.id,
      steps: ((item.progress ?? []) as unknown as ProgressStep[]).sort(
        (a, b) => a.step_order - b.step_order
      ),
      files: allFiles as ItemFile[],
    });
    if (!keepMessage) setMessage(null);
  }, []);

  // Rozpocznij / zakończ etap
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

    // Odśwież dane zamówienia — keepMessage=true żeby nie nadpisać komunikatu
    if (scannedOrder) {
      await handleQrScanned(`/orders/${scannedOrder.orderId}`, true);
    }

    if (action === "complete") {
      setMessage({
        type: "success",
        text: `Ukończono: ${data.stepName}`,
        nextStep: data.nextStep ?? null,
        allDone: data.allDone ?? false,
      });
    } else {
      setMessage({
        type: "success",
        text: `Rozpoczęto: ${data.stepName}`,
      });
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

      {/* Stanowiska — pigulki grup */}
      <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
          <Cog size={14} />
          Twoje stanowiska
        </label>
        {machineGroups.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {machineGroups.map((g) => {
              const isSelected = selectedGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-zinc-400">Ładowanie...</p>
        )}

        {/* Dropdown maszyny — filtrowany po grupach */}
        {selectedGroupIds.length > 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Maszyna (opcjonalnie)
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => changeMachine(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">— Dowolna —</option>
              {filteredMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.group})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedGroupIds.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-600">
            Wybierz stanowiska zanim zaczniesz skanowac
          </p>
        )}
      </div>

      {/* Komunikat */}
      {message && (
        <div
          className={`mb-4 rounded-lg border ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50"
              : message.type === "warning"
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
          }`}
        >
          <div
            className={`px-4 py-3 text-[13px] ${
              message.type === "success"
                ? "text-emerald-700"
                : message.type === "warning"
                  ? "text-amber-700"
                  : "text-red-700"
            }`}
          >
            {message.text}
          </div>

          {/* Kolejny krok — po zakończeniu etapu */}
          {message.type === "success" && message.allDone && (
            <div className="border-t border-emerald-200 bg-emerald-100/50 px-4 py-4 text-center">
              <p className="text-[15px] font-semibold text-emerald-800">
                Wszystkie etapy ukończone!
              </p>
              <p className="mt-1 text-[13px] text-emerald-600">
                Przekaż do pakowania i wysyłki
              </p>
            </div>
          )}

          {message.type === "success" && message.nextStep && !message.allDone && (
            <div className="border-t border-emerald-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Kolejny krok
              </p>
              <p className="mt-1 text-[16px] font-semibold text-zinc-900">
                {message.nextStep.name}
              </p>
              {message.nextStep.group && (
                <p className="mt-0.5 text-[13px] text-zinc-500">
                  Stanowisko: <span className="font-medium text-zinc-700">{message.nextStep.group}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Potwierdzenie skip */}
      {confirmSkip && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] font-medium text-amber-800">
            Poprzedni etap ({confirmSkip.stepName}) nie jest ukończony.
          </p>
          <p className="mt-1 text-[12px] text-amber-600">
            Czy potwierdzasz, że ta część została wykonana?
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
              Uruchom kamerę
            </button>
          )}
        </div>
      )}

      {/* Zeskanowane zamówienie */}
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

          {/* Pliki pozycji */}
          {scannedOrder.files.length > 0 && (
            <div className="border-b border-zinc-100 px-5 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Pliki
              </p>
              <div className="space-y-1.5">
                {scannedOrder.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2"
                  >
                    {file.mime_type.startsWith("image/") ? (
                      <ImageIcon size={14} className="flex-shrink-0 text-blue-500" />
                    ) : (
                      <FileText size={14} className="flex-shrink-0 text-red-500" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-900">
                      {file.file_name}
                    </span>
                    <span className="flex-shrink-0 text-[11px] text-zinc-400">
                      {file.file_size < 1024 * 1024
                        ? `${(file.file_size / 1024).toFixed(0)} KB`
                        : `${(file.file_size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button
                      onClick={async () => {
                        const supabase = createClient();
                        const { data } = await supabase.storage
                          .from("order-files")
                          .createSignedUrl(file.file_path, 60);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      }}
                      className="flex-shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      title="Pobierz"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Etapy produkcji
            </p>
            <div className="space-y-2">
              {scannedOrder.steps.map((step) => {
                const isCompleted = step.status === "completed";
                const isInProgress = step.status === "in_progress";
                const isPending = step.status === "pending";
                const isSkipped = step.status === "skipped";
                const isLoading = actionLoading === step.id;

                // Sprawdz czy etap pasuje do wybranych grup stanowisk
                const stepGroupId = (step.step as { machine_group_id: string | null })?.machine_group_id;
                const stepGroupName = stepGroupId
                  ? machineGroups.find((g) => g.id === stepGroupId)?.name
                  : null;
                const groupMismatch =
                  selectedGroupIds.length > 0 && stepGroupId && !selectedGroupIds.includes(stepGroupId);

                return (
                  <div key={step.id}>
                    <div
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                        isCompleted || isSkipped
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

                      {(isCompleted || isSkipped) && (
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
                            "Zakończ"
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
                    {groupMismatch && (isPending || isInProgress) && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
                          <div className="text-[12px]">
                            <p className="font-medium text-red-700">
                              Inne stanowisko: {stepGroupName}
                            </p>
                            {selectedGroupNames.length > 0 && (
                              <p className="mt-0.5 text-red-500">
                                Twoje: {selectedGroupNames.join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
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
              Skanuj kolejną kartę
            </button>
          </div>
        </div>
      )}

      {/* Reczne wpisanie numeru */}
      <div className="mt-4 text-center">
        <p className="text-[11px] text-zinc-400">
          Lub wpisz numer zamówienia recznie:
        </p>
        <input
          type="text"
          placeholder="GP-260619-0001"
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-center font-mono text-[13px] placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const input = e.currentTarget.value.trim();
              if (input) {
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
                        text: "Zamówienie nie znalezione",
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
