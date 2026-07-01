"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User,
  Plus,
  FileText,
  Pencil,
  Trash2,
  Package,
  Star,
  ShieldOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyForm } from "@/components/crm/company-form";
import { ContactForm } from "@/components/crm/contact-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { STATUS_CONFIG } from "@/lib/order-constants";

interface Company {
  id: string;
  name: string;
  nip: string | null;
  address: string | null;
  notes: string | null;
}

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_blacklisted: boolean;
  anonymized_at: string | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  created_at: string;
}

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [showDeleteCompany, setShowDeleteCompany] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [deleteContactLoading, setDeleteContactLoading] = useState(false);
  const [anonymizeContact, setAnonymizeContact] = useState<Contact | null>(null);
  const [anonymizeLoading, setAnonymizeLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [companyRes, contactsRes, ordersRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, nip, address, notes")
        .eq("id", id)
        .single(),
      supabase
        .from("contacts")
        .select("id, full_name, email, phone, is_primary, is_blacklisted, anonymized_at")
        .eq("company_id", id)
        .order("is_primary", { ascending: false })
        .order("full_name"),
      supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total_price, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setCompany(companyRes.data);
    setContacts(contactsRes.data ?? []);
    setOrders(ordersRes.data ?? []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDeleteCompany() {
    setDeleteLoading(true);
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/crm");
      router.refresh();
    } else {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteContact() {
    if (!deleteContact) return;
    setDeleteContactLoading(true);
    const res = await fetch(`/api/contacts/${deleteContact.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteContact(null);
      setDeleteContactLoading(false);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Blad usuwania");
      setDeleteContactLoading(false);
    }
  }

  async function handleAnonymize() {
    if (!anonymizeContact) return;
    setAnonymizeLoading(true);
    const res = await fetch(`/api/contacts/${anonymizeContact.id}/anonymize`, {
      method: "POST",
    });
    if (res.ok) {
      setAnonymizeContact(null);
      setAnonymizeLoading(false);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Blad anonimizacji");
      setAnonymizeLoading(false);
    }
  }

  // Statystyki obrotu
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.total_price ?? 0),
    0
  );
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-zinc-400">Ladowanie...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center">
        <p className="text-zinc-500">Firma nie znaleziona</p>
        <Link href="/crm" className="mt-2 text-sm text-blue-600 hover:underline">
          Wstecz do CRM
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/crm"
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft size={14} />
          Klienci
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
              <Building2 size={22} className="text-zinc-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">
                {company.name}
              </h1>
              <p className="text-[13px] text-zinc-500">
                {company.nip ? `NIP: ${company.nip}` : ""}
                {company.nip && company.address ? " · " : ""}
                {company.address ?? ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/crm/${id}/offer`}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <FileText size={14} />
              Oferta
            </Link>
            <button
              onClick={() => setShowEditCompany(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Pencil size={14} />
              Edytuj
            </button>
            <button
              onClick={() => setShowDeleteCompany(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
              Usun
            </button>
          </div>
        </div>
      </div>

      {/* Notatki */}
      {company.notes && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[13px] text-zinc-600">{company.notes}</p>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-zinc-900">{orders.length}</p>
          <p className="text-[12px] text-zinc-500">Zamówienia</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-zinc-900">
            {totalRevenue.toLocaleString("pl-PL")} zl
          </p>
          <p className="text-[12px] text-zinc-500">Obrot</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-zinc-900">
            {avgOrder > 0 ? `${Math.round(avgOrder)} zl` : "\u2014"}
          </p>
          <p className="text-[12px] text-zinc-500">Srednia wartosc</p>
        </div>
      </div>

      {/* Kontakty */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            <User size={14} />
            Osoby kontaktowe ({contacts.length})
          </h2>
          <button
            onClick={() => setShowAddContact(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus size={14} />
            Dodaj kontakt
          </button>
        </div>
        {contacts.length > 0 ? (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                    {contact.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-900">
                      {contact.full_name}
                      {contact.is_primary && (
                        <Star
                          size={12}
                          className="fill-amber-400 text-amber-400"
                        />
                      )}
                      {contact.is_blacklisted && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Czarna lista</span>
                      )}
                      {contact.anonymized_at && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Zanonimizowany</span>
                      )}
                    </p>
                    <p className="text-[12px] text-zinc-500">
                      {[contact.email, contact.phone]
                        .filter(Boolean)
                        .join(" · ") || "Brak danych"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!contact.anonymized_at && (
                    <>
                      <button
                        onClick={() => setEditContact(contact)}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        title="Edytuj"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setAnonymizeContact(contact)}
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-purple-50 hover:text-purple-500"
                        title="Anonimizuj dane (RODO)"
                      >
                        <ShieldOff size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setDeleteContact(contact)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                    title="Usuń"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <p className="text-[13px] text-zinc-500">
              Brak kontaktow — dodaj pierwsza osobe
            </p>
          </div>
        )}
      </div>

      {/* Historia zamówień */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
          <Package size={14} />
          Historia zamówień ({orders.length})
        </h2>
        {orders.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Nr
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Wartosc
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    color: "bg-zinc-50 text-zinc-600 border-zinc-200",
                  };
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-mono text-[13px] font-medium text-zinc-900 hover:text-blue-600"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[12px] font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-zinc-600">
                        {order.total_price
                          ? `${order.total_price.toLocaleString("pl-PL")} zl`
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-zinc-500">
                        {new Date(order.created_at).toLocaleDateString("pl-PL")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <p className="text-[13px] text-zinc-500">
              Brak zamówień od tej firmy
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditCompany && (
        <CompanyForm
          company={company}
          onClose={() => {
            setShowEditCompany(false);
            fetchData();
          }}
        />
      )}

      {showDeleteCompany && (
        <ConfirmDialog
          title="Usun firme"
          message={`Czy na pewno chcesz usunac "${company.name}"? Kontakty firmy nie zostana usuniete — stana sie klientami prywatnymi.`}
          loading={deleteLoading}
          onConfirm={handleDeleteCompany}
          onCancel={() => setShowDeleteCompany(false)}
        />
      )}

      {showAddContact && (
        <ContactForm
          companyId={id}
          onClose={() => {
            setShowAddContact(false);
            fetchData();
          }}
        />
      )}

      {editContact && (
        <ContactForm
          contact={editContact}
          companyId={id}
          onClose={() => {
            setEditContact(null);
            fetchData();
          }}
        />
      )}

      {deleteContact && (
        <ConfirmDialog
          title="Usun kontakt"
          message={`Czy na pewno chcesz usunac "${deleteContact.full_name}"?`}
          loading={deleteContactLoading}
          onConfirm={handleDeleteContact}
          onCancel={() => setDeleteContact(null)}
        />
      )}

      {anonymizeContact && (
        <ConfirmDialog
          title="Anonimizacja danych (RODO)"
          message={`Czy na pewno chcesz zanonimizować dane "${anonymizeContact.full_name}"? Imię, email, telefon zostaną usunięte. Zamówienia pozostaną w systemie bez danych osobowych. Pliki klienta zostaną usunięte. Tej operacji NIE MOŻNA cofnąć.`}
          loading={anonymizeLoading}
          onConfirm={handleAnonymize}
          onCancel={() => setAnonymizeContact(null)}
        />
      )}
    </div>
  );
}
