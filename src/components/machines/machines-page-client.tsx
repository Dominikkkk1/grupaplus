"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Cog, Star, Pencil, Trash2 } from "lucide-react";
import { MachineGroupForm } from "./machine-group-form";
import { MachineForm } from "./machine-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Machine {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  notes: string | null;
}

interface MachineGroup {
  id: string;
  name: string;
  description: string | null;
  machines: Machine[];
}

export function MachinesPageClient({
  groups,
}: {
  groups: MachineGroup[];
}) {
  const router = useRouter();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editGroup, setEditGroup] = useState<MachineGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<MachineGroup | null>(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);
  const [addMachineGroupId, setAddMachineGroupId] = useState<string | null>(null);
  const [editMachine, setEditMachine] = useState<{
    machine: Machine;
    groupId: string;
  } | null>(null);
  const [deleteMachine, setDeleteMachine] = useState<Machine | null>(null);
  const [deleteMachineLoading, setDeleteMachineLoading] = useState(false);

  async function handleDeleteGroup() {
    if (!deleteGroup) return;
    setDeleteGroupLoading(true);
    const res = await fetch(`/api/machine-groups/${deleteGroup.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteGroup(null);
      setDeleteGroupLoading(false);
      router.refresh();
    } else {
      setDeleteGroupLoading(false);
    }
  }

  async function handleDeleteMachine() {
    if (!deleteMachine) return;
    setDeleteMachineLoading(true);
    const res = await fetch(`/api/machines/${deleteMachine.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteMachine(null);
      setDeleteMachineLoading(false);
      router.refresh();
    } else {
      setDeleteMachineLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Maszyny</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {groups.length} grup maszyn
          </p>
        </div>
        <button
          onClick={() => setShowGroupForm(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          <Plus size={16} />
          Dodaj grupe
        </button>
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const machines = [...group.machines].sort(
              (a, b) => b.priority - a.priority
            );
            return (
              <div
                key={group.id}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Cog size={16} className="text-zinc-400" />
                    <h3 className="text-[13px] font-semibold text-zinc-900">
                      {group.name}
                    </h3>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setEditGroup(group)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      title="Edytuj grupe"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteGroup(group)}
                      className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      title="Usun grupe"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {group.description && (
                  <p className="border-b border-zinc-50 px-4 py-2 text-[12px] text-zinc-500">
                    {group.description}
                  </p>
                )}
                <div className="p-3">
                  {machines.length > 0 ? (
                    <div className="space-y-1.5">
                      {machines.map((machine) => (
                        <div
                          key={machine.id}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-zinc-50"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                machine.is_active
                                  ? "bg-emerald-400"
                                  : "bg-zinc-300"
                              }`}
                            />
                            <span className="text-[13px] text-zinc-700">
                              {machine.name}
                            </span>
                            {machine.priority >= 10 && (
                              <span className="flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-600">
                                <Star size={10} />
                                Priorytet
                              </span>
                            )}
                          </div>
                          <div className="flex gap-0.5">
                            <button
                              onClick={() =>
                                setEditMachine({
                                  machine,
                                  groupId: group.id,
                                })
                              }
                              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={() => setDeleteMachine(machine)}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-[12px] text-zinc-400">
                      Brak maszyn
                    </p>
                  )}
                  <button
                    onClick={() => setAddMachineGroupId(group.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 py-1.5 text-[12px] font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                  >
                    <Plus size={12} />
                    Dodaj maszyne
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-[13px] text-zinc-500">
            Brak grup maszyn — dodaj pierwsza
          </p>
        </div>
      )}

      {/* Modals */}
      {showGroupForm && (
        <MachineGroupForm onClose={() => { setShowGroupForm(false); router.refresh(); }} />
      )}
      {editGroup && (
        <MachineGroupForm
          group={editGroup}
          onClose={() => { setEditGroup(null); router.refresh(); }}
        />
      )}
      {deleteGroup && (
        <ConfirmDialog
          title="Usun grupe"
          message={`Usunac "${deleteGroup.name}"? Wszystkie maszyny w grupie zostana usuniete.`}
          loading={deleteGroupLoading}
          onConfirm={handleDeleteGroup}
          onCancel={() => setDeleteGroup(null)}
        />
      )}
      {addMachineGroupId && (
        <MachineForm
          groupId={addMachineGroupId}
          onClose={() => { setAddMachineGroupId(null); router.refresh(); }}
        />
      )}
      {editMachine && (
        <MachineForm
          machine={editMachine.machine}
          groupId={editMachine.groupId}
          onClose={() => { setEditMachine(null); router.refresh(); }}
        />
      )}
      {deleteMachine && (
        <ConfirmDialog
          title="Usun maszyne"
          message={`Usunac "${deleteMachine.name}"?`}
          loading={deleteMachineLoading}
          onConfirm={handleDeleteMachine}
          onCancel={() => setDeleteMachine(null)}
        />
      )}
    </>
  );
}
