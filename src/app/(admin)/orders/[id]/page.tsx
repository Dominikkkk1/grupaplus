import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
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
  Printer,
  Star,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { WorkflowChecklist } from "@/components/orders/workflow-checklist";
import { ItemWorkflowBuilder } from "@/components/orders/item-workflow-builder";
import { FileUpload } from "@/components/orders/file-upload";
import { OrderActions } from "@/components/orders/order-actions";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import { DuplicateOrderButton } from "@/components/orders/duplicate-order-button";
import { STATUS_CONFIG, SOURCE_LABELS, getClientStatus } from "@/lib/order-constants";

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
      contact:contacts(full_name, email, phone, is_blacklisted),
      company:companies(name, nip, address)
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  // Rola uzytkownika
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const userRole = profile?.role ?? "client";
  const isClient = userRole === "client";

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(`
      *,
      product:products(name, sku),
      progress:order_item_progress(
        id, step_order, status, completed_at, notes,
        step:workflow_steps(name, color),
        completed_by_user:users!order_item_progress_completed_by_fkey(full_name),
        machine:machines(name)
      )
    `)
    .eq("order_id", id)
    .order("created_at");

  if (itemsError) {
    console.error("[ORDER DETAIL] items query error:", itemsError.message, itemsError.details, itemsError.hint);
  }
  console.log("[ORDER DETAIL] orderId=%s items=%d error=%s", id, items?.length ?? 0, itemsError?.message ?? "none");

  // Pliki, zgłoszenia, użytkownicy (do przypisania)
  const [filesRes, complaintsRes, usersRes] = await Promise.all([
    supabase
      .from("order_files")
      .select("id, file_name, file_size, mime_type, file_path, preflight_status, preflight_result, order_item_id, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("complaints")
      .select(
        "id, type, reason, status, reprint_quantity, notes, created_at, resolved_at, reported_by_user:users(full_name), revert_step:workflow_steps(name)"
      )
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("users")
      .select("id, full_name, role")
      .in("role", ["admin", "operator"])
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const files = filesRes.data ?? [];
  const complaints = complaintsRes.data ?? [];
  const teamUsers = usersRes.data ?? [];

  // Workflow steps — do buildera recznego workflow
  const { data: workflowStepsData } = await supabase
    .from("workflow_steps")
    .select("id, name, color")
    .order("name");
  const allWorkflowSteps = (workflowStepsData ?? []) as { id: string; name: string; color: string }[];

  const status = STATUS_CONFIG[order.status] ?? {
    label: order.status,
    color: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
  const contact = order.contact as { full_name: string; email: string; phone: string; is_blacklisted: boolean } | null;
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
          Zamówienia
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {order.is_priority && (
              <Star size={18} className="fill-amber-400 text-amber-400" />
            )}
            <h1 className="text-base font-semibold text-zinc-900 sm:text-lg">
              {order.order_number}
            </h1>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 sm:text-[12px]">
              {SOURCE_LABELS[order.source] ?? order.source}
            </span>
          </div>
          {!isClient && (
            <div className="flex gap-2">
              <DuplicateOrderButton
                items={(items ?? []).map(i => ({
                  description: (i.product as {name:string}|null)?.name ?? i.description,
                  quantity: i.quantity,
                  unitPrice: i.unit_price ? String(i.unit_price) : "",
                }))}
                customerName={contact?.full_name ?? ""}
                customerEmail={contact?.email ?? ""}
                customerPhone={contact?.phone ?? ""}
              />
              <a
                href={`/orders/${id}/print`}
                target="_blank"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:px-3 sm:py-2 sm:text-[13px]"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Drukuj kartę</span>
                <span className="sm:hidden">Drukuj</span>
              </a>
            </div>
          )}
        </div>

        {/* Status bar dla klienta */}
        {isClient && (
          <div className="mt-3">
            <ClientStatusBar status={order.status} />
          </div>
        )}

        {!isClient && <OrderActions
          orderId={id}
          currentStatus={order.status}
          isPriority={order.is_priority ?? false}
          sentForApprovalAt={order.sent_for_approval_at as string | null}
          assignedTo={order.assigned_to as string | null}
          teamUsers={(teamUsers ?? []) as unknown as { id: string; full_name: string; role: string }[]}
          items={(items ?? []).map((i) => ({
            id: i.id,
            description: (i.product as {name: string} | null)?.name ?? i.description,
            progress: ((i.progress ?? []) as unknown as { step_id: string; step_order: number; step: { name: string } }[]),
          }))}
          complaints={(complaints ?? []) as unknown as { id: string; type: string; reason: string; status: string; reprint_quantity: number | null; notes: string | null; created_at: string; resolved_at: string | null; reported_by_user: { full_name: string } | null; revert_step: { name: string } | null }[]}
        />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kolumna lewa — pozycje + workflow */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            Pozycje zamówienia
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
                          <span>{item.unit_price} zł/szt.</span>
                        )}
                        {item.unit_price && item.quantity > 0 && (
                          <span className="font-medium text-zinc-700">= {(Number(item.unit_price) * item.quantity).toFixed(2)} zł</span>
                        )}
                      </div>
                    </div>
                    {item.is_completed && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Ukończone
                      </span>
                    )}
                  </div>

                  {/* Checklista workflow — tylko admin/operator */}
                  {!isClient && (
                    progress && progress.length > 0 ? (
                      <WorkflowChecklist
                        orderItemId={item.id}
                        steps={progress}
                      />
                    ) : (
                      <ItemWorkflowBuilder
                        orderId={id}
                        orderItemId={item.id}
                        allSteps={allWorkflowSteps}
                      />
                    )
                  )}

                  {/* Pliki per pozycje */}
                  <div className="border-t border-zinc-100 px-4 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Pliki
                    </p>
                    <FileUpload
                      orderId={id}
                      orderItemId={item.id}
                      files={((files ?? []) as unknown as { id: string; file_name: string; file_size: number; mime_type: string; file_path: string; preflight_status: string | null; preflight_result: { checks?: { status: "passed"|"warning"|"failed"; label: string; value: string; message?: string }[] } | null; order_item_id: string | null; created_at: string }[]).filter(f => f.order_item_id === item.id)}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
              <p className="text-[13px] text-zinc-500">Brak pozycji</p>
            </div>
          )}
        </div>

        {/* Kolumna prawa — dane zamówienia */}
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
                {contact.is_blacklisted && (
                  <div className="mt-2 flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-700">
                    <AlertTriangle size={13} />
                    Klient na czarnej liście
                  </div>
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

          {/* Szczegóły */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
              <FileText size={14} />
              Szczegóły
            </h3>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <CreditCard size={14} />
                  Płatność
                </span>
                <span className="font-medium text-zinc-900">
                  {order.payment_status === "paid"
                    ? "Opłacone"
                    : order.payment_status === "cod"
                      ? "Za pobraniem"
                      : "Oczekuje"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Odbiór</span>
                <span className={`font-medium ${order.delivery_type === "pickup" ? "text-emerald-700" : "text-zinc-900"}`}>
                  {order.delivery_type === "pickup" ? "Odbiór osobisty" : "Wysyłka"}
                </span>
              </div>

              {order.total_price && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Wartość</span>
                  <span className="font-medium text-zinc-900">
                    {Number(order.total_price).toFixed(2)} zł
                  </span>
                </div>
              )}

              {order.shipping_method && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <MapPin size={14} />
                    Wysyłka
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

          {/* Usuń zamówienie — tylko admin */}
          {userRole === "admin" && <DeleteOrderButton orderId={id} />}

          {/* Uwagi */}
          {order.notes && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-amber-700">
                <MessageSquare size={14} />
                Uwagi
              </h3>
              <p className="text-[14px] font-medium text-amber-900 whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          )}

          {/* Pliki ogolne zamówienia (bez przypisanej pozycji) */}
          {((files ?? []) as unknown as { order_item_id: string | null }[]).filter(f => !f.order_item_id).length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                <FileText size={14} />
                Pliki ogolne
              </h3>
              <FileUpload
                orderId={id}
                files={((files ?? []) as unknown as { id: string; file_name: string; file_size: number; mime_type: string; file_path: string; preflight_status: string | null; preflight_result: { checks?: { status: "passed"|"warning"|"failed"; label: string; value: string; message?: string }[] } | null; order_item_id: string | null; created_at: string }[]).filter(f => !f.order_item_id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Wizualny pasek statusu dla klienta (4 kroki) */
function ClientStatusBar({ status }: { status: string }) {
  const steps = [
    { key: "accepted", label: "Przyjęte" },
    { key: "production", label: "W realizacji" },
    { key: "shipped", label: "Wysłane" },
  ];

  let activeIndex = 0;
  if (status === "in_production" || status === "ready") activeIndex = 1;
  if (status === "shipped" || status === "delivered") activeIndex = 2;
  if (status === "cancelled") activeIndex = -1;

  if (status === "cancelled") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-[13px] font-medium text-red-700">
        Zamówienie anulowane
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-center gap-1">
          <div className="flex flex-1 flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${
                i <= activeIndex
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`mt-1 text-center text-[11px] ${
                i <= activeIndex
                  ? "font-medium text-emerald-700"
                  : "text-zinc-400"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mt-[-16px] h-0.5 flex-1 ${
                i < activeIndex ? "bg-emerald-400" : "bg-zinc-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
