"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { STATUS_CONFIG, ALLOWED_TRANSITIONS } from "@/lib/order-constants";
import { ComplaintForm } from "./complaint-form";

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
  progress: { step_id: string; step_order: number; step: { name: string } }[];
}

export function OrderActions({
  orderId,
  currentStatus,
  assignedTo,
  teamUsers,
  items,
  complaints,
}: {
  orderId: string;
  currentStatus: string;
  assignedTo: string | null;
  teamUsers: { id: string; full_name: string; role: string }[];
  items: OrderItem[];
  complaints: Complaint[];
}) {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);

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
    resolved: { label: "Rozwiazane", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Odrzucone", color: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  };

  return (
    <>
      {/* Status + przypisanie + zgloszenie */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* Status dropdown */}
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${statusConfig.color}`}
          >
            {statusConfig.label}
          </span>
          {allowedNext.length > 0 && (
            <select
              disabled={statusLoading}
              value=""
              onChange={(e) => {
                if (e.target.value) changeStatus(e.target.value);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-600 focus:border-zinc-900 focus:outline-none"
            >
              <option value="">Zmien na...</option>
              {allowedNext.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s]?.label ?? s}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Osoba odpowiedzialna (nadzorujaca — poszczegolne etapy maja swoich operatorow logowanych przez skan) */}
        <div className="flex items-center gap-1.5">
          <UserPlus size={14} className="text-zinc-400" />
          <select
            disabled={assignLoading}
            value={assignedTo ?? ""}
            onChange={(e) => assignUser(e.target.value || null)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[12px] text-zinc-600 focus:border-zinc-900 focus:outline-none"
            title="Osoba nadzorujaca zamowienie. Operatorzy na poszczegolnych etapach sa logowani automatycznie przez skan."
          >
            <option value="">Osoba odpowiedzialna</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Przycisk zgloszenia */}
        <button
          onClick={() => setShowComplaintForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1 text-[12px] font-medium text-amber-700 hover:bg-amber-50"
        >
          <AlertTriangle size={12} />
          Zglos incydent
        </button>
      </div>

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
                      ` · Cofnieto do: ${(c.revert_step as { name: string }).name}`}
                    {c.reprint_quantity &&
                      ` · Dodruk: ${c.reprint_quantity} szt.`}
                  </p>
                </div>
                {c.status === "open" && (
                  <button
                    onClick={() => resolveComplaint(c.id)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
                  >
                    Rozwiaz
                  </button>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="mt-4">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
              Zgloszenia ({complaints.length})
            </h3>
            {/* Otwarte — zawsze widoczne */}
            {openComplaints.length > 0 && (
              <div className="space-y-2">
                {openComplaints.map(renderComplaint)}
              </div>
            )}
            {/* Rozwiazane — collapsible */}
            {resolvedComplaints.length > 0 && (
              <details className={openComplaints.length > 0 ? "mt-3" : ""}>
                <summary className="cursor-pointer text-[12px] font-medium text-zinc-400 hover:text-zinc-600">
                  Rozwiazane ({resolvedComplaints.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {resolvedComplaints.map(renderComplaint)}
                </div>
              </details>
            )}
          </div>
        );
      })()}

      {/* Modal zgloszenia */}
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
