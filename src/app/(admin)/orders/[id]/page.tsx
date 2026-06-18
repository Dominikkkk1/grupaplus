import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Package,
  User,
  Building2,
  MapPin,
  CreditCard,
  FileText,
} from "lucide-react";
import { WorkflowChecklist } from "@/components/orders/workflow-checklist";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "Nowe", color: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Potwierdzone", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  in_production: { label: "W produkcji", color: "bg-amber-50 text-amber-700 border-amber-200" },
  ready: { label: "Gotowe", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  shipped: { label: "Wyslane", color: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered: { label: "Dostarczone", color: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  cancelled: { label: "Anulowane", color: "bg-red-50 text-red-700 border-red-200" },
};

const SOURCE_LABELS: Record<string, string> = {
  allegro: "Allegro",
  woo: "Sklep WWW",
  email: "Email",
  stacjonarne: "Stacjonarne",
  baselinker: "BaseLinker",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      contact:contacts(full_name, email, phone),
      company:companies(name, nip, address)
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select(`
      *,
      product:products(name, sku),
      progress:order_item_progress(
        id, step_order, status, completed_at, notes,
        step:workflow_steps(name, color),
        completed_by_user:users(full_name),
        machine:machines(name)
      )
    `)
    .eq("order_id", id)
    .order("created_at");

  const status = STATUS_CONFIG[order.status] ?? {
    label: order.status,
    color: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
  const contact = order.contact as { full_name: string; email: string; phone: string } | null;
  const company = order.company as { name: string; nip: string; address: string } | null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/orders"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft size={14} />
          Zamowienia
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-900">
            {order.order_number}
          </h1>
          <span className={`rounded-md border px-2 py-0.5 text-[12px] font-medium ${status.color}`}>
            {status.label}
          </span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[12px] text-zinc-500">
            {SOURCE_LABELS[order.source] ?? order.source}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kolumna lewa — pozycje + workflow */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            Pozycje zamowienia
          </h2>

          {items && items.length > 0 ? (
            items.map((item) => {
              const product = item.product as { name: string; sku: string } | null;
              const progress = (
                item.progress as {
                  id: string;
                  step_order: number;
                  status: string;
                  completed_at: string | null;
                  notes: string | null;
                  step: { name: string; color: string };
                  completed_by_user: { full_name: string } | null;
                  machine: { name: string } | null;
                }[]
              )?.sort((a, b) => a.step_order - b.step_order);

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                    <div>
                      <p className="text-[14px] font-medium text-zinc-900">
                        {product?.name ?? item.description}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-[12px] text-zinc-500">
                        <span>{item.quantity} szt.</span>
                        {product?.sku && (
                          <span className="font-mono">{product.sku}</span>
                        )}
                        {item.unit_price && (
                          <span>{item.unit_price} zl/szt.</span>
                        )}
                      </div>
                    </div>
                    {item.is_completed && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Ukonczone
                      </span>
                    )}
                  </div>

                  {/* Checklista workflow */}
                  {progress && progress.length > 0 ? (
                    <WorkflowChecklist
                      orderItemId={item.id}
                      steps={progress}
                    />
                  ) : (
                    <div className="px-4 py-6 text-center text-[13px] text-zinc-400">
                      Brak przypisanego workflow (zlecenie bez produktu)
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
              <p className="text-[13px] text-zinc-500">Brak pozycji</p>
            </div>
          )}
        </div>

        {/* Kolumna prawa — dane zamowienia */}
        <div className="space-y-4">
          {/* Klient */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
              <User size={14} />
              Klient
            </h3>
            {contact ? (
              <div className="space-y-1.5 text-[13px]">
                <p className="font-medium text-zinc-900">{contact.full_name}</p>
                {contact.email && (
                  <p className="text-zinc-500">{contact.email}</p>
                )}
                {contact.phone && (
                  <p className="text-zinc-500">{contact.phone}</p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-zinc-400">Brak danych klienta</p>
            )}
          </div>

          {/* Firma */}
          {company && (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                <Building2 size={14} />
                Firma
              </h3>
              <div className="space-y-1.5 text-[13px]">
                <p className="font-medium text-zinc-900">{company.name}</p>
                {company.nip && (
                  <p className="text-zinc-500">NIP: {company.nip}</p>
                )}
                {company.address && (
                  <p className="text-zinc-500">{company.address}</p>
                )}
              </div>
            </div>
          )}

          {/* Szczegoly */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
              <FileText size={14} />
              Szczegoly
            </h3>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <CreditCard size={14} />
                  Platnosc
                </span>
                <span className="font-medium text-zinc-900">
                  {order.payment_status === "paid"
                    ? "Oplacone"
                    : order.payment_status === "cod"
                      ? "Za pobraniem"
                      : "Oczekuje"}
                </span>
              </div>

              {order.total_price && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Wartosc</span>
                  <span className="font-medium text-zinc-900">
                    {Number(order.total_price).toFixed(2)} zl
                  </span>
                </div>
              )}

              {order.shipping_method && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <MapPin size={14} />
                    Wysylka
                  </span>
                  <span className="font-medium text-zinc-900">
                    {order.shipping_method}
                  </span>
                </div>
              )}

              {order.deadline && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <Clock size={14} />
                    Deadline
                  </span>
                  <span className="font-medium text-zinc-900">
                    {new Date(order.deadline).toLocaleDateString("pl-PL")}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Utworzono</span>
                <span className="text-zinc-900">
                  {new Date(order.created_at).toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Uwagi */}
          {order.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                Uwagi
              </h3>
              <p className="text-[13px] text-zinc-700 whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
