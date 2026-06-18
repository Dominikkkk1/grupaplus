import { createClient } from "@/lib/supabase/server";
import { Cog, Plus, Star } from "lucide-react";

export default async function MachinesPage() {
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("machine_groups")
    .select(`
      *,
      machines(id, name, priority, is_active)
    `)
    .order("name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Maszyny</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Grupy maszyn i poszczegolne urzadzenia
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
          <Plus size={16} />
          Dodaj grupe
        </button>
      </div>

      {groups && groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const machines = (group.machines as {
              id: string;
              name: string;
              priority: number;
              is_active: boolean;
            }[])?.sort((a, b) => b.priority - a.priority);

            return (
              <div
                key={group.id}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                    <Cog size={16} className="text-zinc-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-zinc-900">
                      {group.name}
                    </h3>
                    {group.description && (
                      <p className="text-[11px] text-zinc-400">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-zinc-100">
                  {machines && machines.length > 0 ? (
                    machines.map((machine) => (
                      <div
                        key={machine.id}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="text-[13px] text-zinc-700">
                          {machine.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {machine.priority >= 10 && (
                            <span className="flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                              <Star size={10} className="fill-amber-500" />
                              Priorytet
                            </span>
                          )}
                          <span
                            className={`h-2 w-2 rounded-full ${
                              machine.is_active ? "bg-emerald-500" : "bg-zinc-300"
                            }`}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-4 text-center text-[12px] text-zinc-400">
                      Brak maszyn
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Cog size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">Brak grup maszyn</p>
        </div>
      )}
    </div>
  );
}
