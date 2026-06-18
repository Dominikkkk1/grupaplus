"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Factory, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface Step {
  id: string;
  name: string;
  color: string;
}

export interface ActiveItem {
  id: string;
  step_id: string;
  status: string;
  order_item: {
    description: string;
    quantity: number;
    order: {
      id: string;
      order_number: string;
      deadline: string | null;
      status: string;
    };
  } | null;
}

export function ProductionBoard({
  steps,
  initialItems,
}: {
  steps: Step[];
  initialItems: ActiveItem[];
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Supabase Realtime — odswierzaj dane gdy ktos zmieni status etapu
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("production-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_item_progress" },
        () => {
          // Debounce 300ms — przy wielu zmianach naraz nie refetchujemy co event
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 300);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Grupuj pozycje wg etapu workflow
  const stepGroups = useMemo(() => {
    const groups = new Map<string, ActiveItem[]>();
    for (const step of steps) {
      groups.set(step.id, []);
    }
    for (const item of initialItems) {
      const existing = groups.get(item.step_id) ?? [];
      existing.push(item);
      groups.set(item.step_id, existing);
    }
    return groups;
  }, [steps, initialItems]);

  // Statystyki
  const pendingCount = initialItems.filter((i) => i.status === "pending").length;
  const inProgressCount = initialItems.filter((i) => i.status === "in_progress").length;

  const now = Date.now();
  const urgentCount = initialItems.filter((i) => {
    const deadline = i.order_item?.order?.deadline;
    if (!deadline) return false;
    return new Date(deadline).getTime() < now + 24 * 60 * 60 * 1000;
  }).length;

  return (
    <>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard
          icon={<Clock size={18} className="text-amber-600" />}
          iconBg="bg-amber-50"
          value={pendingCount}
          label="Oczekujace"
        />
        <StatCard
          icon={<Factory size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          value={inProgressCount}
          label="W realizacji"
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-red-600" />}
          iconBg="bg-red-50"
          value={urgentCount}
          label="Zagrozony termin"
        />
      </div>

      {/* Board */}
      {steps.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {steps.map((step) => {
            const items = stepGroups.get(step.id) ?? [];
            return (
              <div
                key={step.id}
                className="w-72 flex-shrink-0 rounded-lg border border-zinc-200 bg-zinc-50/50"
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: step.color }}
                  />
                  <h3 className="text-[13px] font-semibold text-zinc-900">
                    {step.name}
                  </h3>
                  <span className="ml-auto rounded-md bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <ProductionCard key={item.id} item={item} now={now} />
                    ))
                  ) : (
                    <p className="py-6 text-center text-[12px] text-zinc-400">
                      Brak pozycji
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
            <CheckCircle2 size={22} className="text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-900">
            Brak danych produkcyjnych
          </p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Etapy workflow pojawia sie po skonfigurowaniu produktow.
          </p>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-semibold text-zinc-900">{value}</p>
          <p className="text-[12px] text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ProductionCard({ item, now }: { item: ActiveItem; now: number }) {
  const orderItem = item.order_item;
  const deadline = orderItem?.order?.deadline;
  const orderId = orderItem?.order?.id;

  let borderClass = "border-zinc-200";
  if (deadline) {
    const deadlineMs = new Date(deadline).getTime();
    if (deadlineMs < now) {
      borderClass = "border-red-400 bg-red-50/30";
    } else if (deadlineMs < now + 24 * 60 * 60 * 1000) {
      borderClass = "border-amber-400 bg-amber-50/30";
    }
  }

  const card = (
    <div
      className={`rounded-lg border ${borderClass} bg-white p-3 shadow-sm transition-colors hover:border-zinc-300`}
    >
      <p className="text-[13px] font-medium text-zinc-900">
        {orderItem?.description ?? "\u2014"}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-zinc-500">
          {orderItem?.quantity ?? 0} szt.
        </span>
        <span className="font-mono text-[11px] text-zinc-400">
          {orderItem?.order?.order_number ?? ""}
        </span>
      </div>
      {deadline && new Date(deadline).getTime() < now + 24 * 60 * 60 * 1000 && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600">
          <Clock size={11} />
          {new Date(deadline).toLocaleDateString("pl-PL")}
        </div>
      )}
    </div>
  );

  if (orderId) {
    return (
      <Link href={`/orders/${orderId}`} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
