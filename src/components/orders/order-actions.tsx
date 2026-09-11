"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus, Star, Hourglass, Send, Truck, MessageSquareWarning, Check } from "lucide-react";
import { STATUS_CONFIG, ALLOWED_TRANSITIONS } from "@/lib/order-constants";
import { CARRIERS } from "@/lib/carriers";
import { APPROVAL_DEADLINE_HOURS, approvalWaitingHours, formatWaitingTime } from "@/lib/approval";
import { ComplaintForm } from "./complaint-form";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";

interface Complaint {
  id: string;
  type: string;
  reason: string;
  status: string;
  reprint_quantity: number | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reported_by_user: { full_name: string } | null;
  revert_step: { name: string } | null;
}

interface OrderItem {
  id: string;
  description: string;
  progress: { step_id: string; step_order: number; branch_type?: string; step: { name: string } }[];
}

export function OrderActions({
  orderId,
  currentStatus,
  isPriority: initialPriority,
  sentForApprovalAt,
  approvalResentCount = 0,
  approvalDecision,
  approvalComment,
  carrier: initialCarrier,
  deliveryType,
  assignedTo,
  teamUsers,
  items,
  complaints,
}: {
  orderId: string;
  currentStatus: string;
  isPriority: boolean;
  sentForApprovalAt: string | null;
  approvalResentCount?: number;
  approvalDecision?: string | null;
  approvalComment?: string | null;
  carrier: string | null;
  deliveryType: string;
  assignedTo: string | null;
  teamUsers: { id: string; full_name: string; role: string }[];
  items: OrderItem[];
  complaints: Complaint[];
}) {
  const router = useRouter();
  useRealtimeRefresh(["orders", "order_item_progress", "complaints"], "order-detail-realtime");
  const [statusLoading, setStatusLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [priorityFlag, setPriorityFlag] = useState(initialPriority);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [carrier, setCarrier] = useState(initialCarrier ?? "");
  const [carrierLoading, setCarrierLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  // Gdy mail do klienta nie mogl pojsc — pokazujemy link do skopiowania
  const [approvalLink, setApprovalLink] = useState<{ url: string; warning: string } | null>(null);

  const now = new Date();

  const statusConfig = STATUS_CONFIG[currentStatus] ?? {
    label: currentStatus,
    color: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  async function changeStatus(newStatus: string) {
    setStatusLoading(true);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusLoading(false);
    router.refresh();
  }

  async function assignUser(userId: string | null) {
    setAssignLoading(true);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo: userId }),
    });
    setAssignLoading(false);
    router.refresh();
  }

  async function togglePriority() {
    setPriorityLoading(true);
    const newVal = !priorityFlag;
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPriority: newVal }),
    });
    setPriorityFlag(newVal);
    setPriorityLoading(false);
    router.refresh();
  }

  async function changeCarrier(value: string) {
    setCarrierLoading(true);
    setCarrier(value);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: value || null }),
    });
    setCarrierLoading(false);
    router.refresh();
  }

  /**
   * "send"   — projekt idzie do klienta po raz pierwszy
   * "resend" — klient dostal poprawiona wersje, zegar 24 h startuje od nowa
   */
  async function sendForApproval(action: "send" | "resend") {
    setApprovalLoading(true);
    const res = await fetch(`/api/orders/${orderId}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Nie udało się zapisać");
    } else if (data.warning) {
      // Brak maila klienta albo nieskonfigurowany Resend — operator wysyła link sam
      setApprovalLink({ url: data.link, warning: data.warning });
    } else {
      setApprovalLink(null);
    }
    setApprovalLoading(false);
    router.refresh();
  }

  async function resolveComplaint(complaintId: string) {
    await fetch(`/api/orders/${orderId}/complaints/${complaintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    router.refresh();
  }

  const COMPLAINT_STATUS: Record<string, { label: string; color: string }> = {
    open: { label: "Otwarte", color: "bg-red-50 text-red-700 border-red-200" },
    in_progress: { label: "W trakcie", color: "bg-amber-50 text-amber-700 border-amber-200" },
    resolved: { label: "Rozwiązane", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Odrzucone", color: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  };

  return (
    <>
      {/* Status + przypisanie + zgłoszenie */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* Status dropdown */}
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${statusConfig.color}`}
          >
            {statusConfig.label}
          </span>
          {currentStatus === "awaiting_approval" && sentForApprovalAt && (() => {
            const hours = approvalWaitingHours(sentForApprovalAt, now) ?? 0;
            const overdue = hours >= APPROVAL_DEADLINE_HOURS;
            return (
              <span
                title={
                  overdue
                    ? `Projekt wysłano ponad ${APPROVAL_DEADLINE_HOURS} h temu i nie ma odpowiedzi klienta`
                    : "Czas liczony od wysłania projektu do klienta"
                }
                className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${overdue ? "border-red-200 bg-red-50 text-red-700" : "border-purple-200 bg-purple-50 text-purple-700"}`}
              >
                <Hourglass size={11} />
                {overdue ? "Brak akceptacji: " : "Czeka "}
                {formatWaitingTime(hours)}
                {approvalResentCount > 0 && ` (po ${approvalResentCount}. poprawce)`}
              </span>
            );
          })()}
          {allowedNext.length > 0 && (
            <select
              disabled={statusLoading}
              value=""
              onChange={(e) => {
                if (e.target.value) changeStatus(e.target.value);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-600 focus:border-zinc-900 focus:outline-none"
            >
              <option value="">Zmień na...</option>
              {allowedNext.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s]?.label ?? s}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Osoba odpowiedzialna (nadzorująca — poszczególne etapy maja swoich operatorów logowanych przez skan) */}
        <div className="flex items-center gap-1.5">
          <UserPlus size={14} className="text-zinc-400" />
          <select
            disabled={assignLoading}
            value={assignedTo ?? ""}
            onChange={(e) => assignUser(e.target.value || null)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-600 focus:border-zinc-900 focus:outline-none"
            title="Osoba nadzorująca zamówienie. Operatorzy na poszczególnych etapach sa logowani automatycznie przez skan."
          >
            <option value="">Osoba odpowiedzialna</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle priorytetu */}
        <button
          onClick={togglePriority}
          disabled={priorityLoading}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[12px] font-medium transition-colors ${
            priorityFlag
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
          }`}
        >
          <Star size={12} className={priorityFlag ? "fill-amber-400 text-amber-400" : ""} />
          {priorityFlag ? "Priorytet" : "Nadaj priorytet"}
        </button>

        {/* Wysylka projektu do akceptacji / ponowna wysylka po poprawce */}
        {currentStatus === "confirmed" && approvalDecision !== "changes_requested" && (
          <button
            onClick={() => sendForApproval("send")}
            disabled={approvalLoading}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 px-3 py-1 text-[12px] font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            title="Wysyła klientowi maila z linkiem do akceptacji, ustawia status na Oczekuje na akceptację i startuje licznik 24 h"
          >
            <Send size={12} />
            Wyślij projekt do akceptacji
          </button>
        )}
        {(currentStatus === "awaiting_approval" ||
          (currentStatus === "confirmed" && approvalDecision === "changes_requested")) && (
          <button
            onClick={() => sendForApproval("resend")}
            disabled={approvalLoading}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 px-3 py-1 text-[12px] font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            title="Wysyła klientowi nowy link. Licznik 24 h startuje od nowa, a poprzedni link przestaje działać"
          >
            <Send size={12} />
            Wyślij poprawioną wersję
          </button>
        )}

        {/* Przewoznik */}
        {deliveryType !== "pickup" && (
          <div className="flex items-center gap-1.5">
            <Truck size={14} className="text-zinc-400" />
            <select
              disabled={carrierLoading}
              value={carrier}
              onChange={(e) => changeCarrier(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-600 focus:border-zinc-900 focus:outline-none"
              title="Przewoźnik — po nim filtrujemy paczki do wydania"
            >
              <option value="">Przewoźnik</option>
              {CARRIERS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Przycisk zgłoszenia */}
        <button
          onClick={() => setShowComplaintForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1 text-[12px] font-medium text-amber-700 hover:bg-amber-50"
        >
          <AlertTriangle size={12} />
          Zgłoś incydent
        </button>
      </div>

      {/* Mail nie poszedl — link do recznego wyslania */}
      {approvalLink && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[12px] font-medium text-amber-900">{approvalLink.warning}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={approvalLink.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded border border-amber-200 bg-white px-2 py-1 font-mono text-[11px] text-zinc-700"
            />
            <button
              onClick={() => navigator.clipboard?.writeText(approvalLink.url)}
              className="rounded-md border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
            >
              Kopiuj
            </button>
          </div>
        </div>
      )}

      {/* Decyzja klienta */}
      {approvalDecision === "changes_requested" && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
            <MessageSquareWarning size={13} />
            Klient prosi o poprawki
          </p>
          {approvalComment ? (
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-amber-900">{approvalComment}</p>
          ) : (
            <p className="mt-1 text-[13px] text-amber-800">Bez dodatkowych uwag.</p>
          )}
          <p className="mt-2 text-[11px] text-amber-700">
            Wgraj poprawiony projekt i kliknij &quot;Wyślij poprawioną wersję&quot; —
            klient dostanie nowy link, licznik 24 h ruszy od nowa, a stary link przestanie działać.
          </p>
        </div>
      )}
      {approvalDecision === "approved" && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-900">
            <Check size={13} />
            Klient zaakceptował projekt
          </p>
        </div>
      )}

      {/* Lista zgloszen */}
      {complaints.length > 0 && (() => {
        const openComplaints = complaints.filter(c => c.status !== "resolved" && c.status !== "rejected");
        const resolvedComplaints = complaints.filter(c => c.status === "resolved" || c.status === "rejected");

        function renderComplaint(c: Complaint) {
          const cs = COMPLAINT_STATUS[c.status] ?? {
            label: c.status,
            color: "bg-zinc-50 text-zinc-600 border-zinc-200",
          };
          return (
            <div
              key={c.id}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        c.type === "internal"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-violet-50 text-violet-600"
                      }`}
                    >
                      {c.type === "internal" ? "Wewn." : "Zewn."}
                    </span>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cs.color}`}
                    >
                      {cs.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-zinc-900">
                    {c.reason}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {(c.reported_by_user as { full_name: string } | null)
                      ?.full_name ?? ""}
                    {" · "}
                    {new Date(c.created_at).toLocaleDateString("pl-PL")}
                    {c.revert_step &&
                      ` · Cofnięto do: ${(c.revert_step as { name: string }).name}`}
                    {c.reprint_quantity &&
                      ` · Dodruk: ${c.reprint_quantity} szt.`}
                  </p>
                </div>
                {c.status === "open" && (
                  <button
                    onClick={() => resolveComplaint(c.id)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    Rozwiąż
                  </button>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="mt-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
              Zgłoszenia ({complaints.length})
            </h3>
            {/* Otwarte — zawsze widoczne */}
            {openComplaints.length > 0 && (
              <div className="space-y-2">
                {openComplaints.map(renderComplaint)}
              </div>
            )}
            {/* Rozwiązane — collapsible */}
            {resolvedComplaints.length > 0 && (
              <details className={openComplaints.length > 0 ? "mt-3" : ""}>
                <summary className="cursor-pointer text-[12px] font-medium text-zinc-400 hover:text-zinc-600">
                  Rozwiązane ({resolvedComplaints.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {resolvedComplaints.map(renderComplaint)}
                </div>
              </details>
            )}
          </div>
        );
      })()}

      {/* Modal zgłoszenia */}
      {showComplaintForm && (
        <ComplaintForm
          orderId={orderId}
          items={items}
          onClose={() => {
            setShowComplaintForm(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
