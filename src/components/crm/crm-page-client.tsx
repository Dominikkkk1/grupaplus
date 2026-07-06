"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2, User, Pencil, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyForm } from "./company-form";
import { ContactForm } from "./contact-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Company {
  id: string;
  name: string;
  nip: string | null;
  address: string | null;
  notes: string | null;
  contacts: { id: string }[];
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

export function CrmPageClient({
  companies,
  privateContacts,
}: {
  companies: Company[];
  privateContacts: Contact[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [anonymizeContact, setAnonymizeContact] = useState<Contact | null>(null);
  const [anonymizeLoading, setAnonymizeLoading] = useState(false);

  async function handleAnonymize() {
    if (!anonymizeContact) return;
    setAnonymizeLoading(true);
    const res = await fetch(`/api/contacts/${anonymizeContact.id}/anonymize`, { method: "POST" });
    if (res.ok) {
      setAnonymizeContact(null);
      setAnonymizeLoading(false);
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Błąd anonimizacji");
      setAnonymizeLoading(false);
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.nip?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  const filteredContacts = privateContacts.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Klienci</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {companies.length} firm, {privateContacts.length} klientow
            prywatnych
          </p>
        </div>
        <button
          onClick={() => setShowCompanyForm(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          <Plus size={16} />
          Dodaj firme
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po nazwie, NIP, nazwisku..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      {/* Firmy */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Building2 size={16} className="text-zinc-400" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            Firmy ({filteredCompanies.length})
          </h2>
        </div>
        {filteredCompanies.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((company) => (
              <Link
                key={company.id}
                href={`/crm/${company.id}`}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 hover:shadow-md"
              >
                <h3 className="text-[14px] font-semibold text-zinc-900">
                  {company.name}
                </h3>
                {company.nip && (
                  <p className="mt-0.5 font-mono text-[12px] text-zinc-400">
                    NIP: {company.nip}
                  </p>
                )}
                {company.address && (
                  <p className="mt-1 text-[12px] text-zinc-500">
                    {company.address}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-zinc-400">
                  {company.contacts.length}{" "}
                  {company.contacts.length === 1 ? "kontakt" : "kontaktów"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] text-zinc-400">
            {query ? "Brak wyników" : "Brak firm"}
          </p>
        )}
      </div>

      {/* Klienci prywatni */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <User size={16} className="text-zinc-400" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            Klienci prywatni ({filteredContacts.length})
          </h2>
        </div>
        {filteredContacts.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Imie i nazwisko
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                    Telefon
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50/50"
                  >
                    <td className="px-4 py-3 text-[13px] font-medium text-zinc-900">
                      <span className="flex items-center gap-1.5">
                        {contact.full_name}
                        {contact.is_blacklisted && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Czarna lista</span>
                        )}
                        {contact.anonymized_at && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Zanonimizowany</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-600">
                      {contact.email ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-zinc-600">
                      {contact.phone ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] text-zinc-400">
            {query ? "Brak wyników" : "Brak klientów prywatnych"}
          </p>
        )}
      </div>

      {/* Modal firma */}
      {showCompanyForm && (
        <CompanyForm onClose={() => setShowCompanyForm(false)} />
      )}

      {/* Modal kontakt */}
      {editContact && (
        <ContactForm
          contact={editContact}
          onClose={() => setEditContact(null)}
        />
      )}

      {/* RODO dialog */}
      {anonymizeContact && (
        <ConfirmDialog
          title="Anonimizacja danych (RODO)"
          message={`Czy na pewno chcesz zanonimizować dane "${anonymizeContact.full_name}"? Imię, email, telefon zostaną usunięte. Zamówienia pozostaną bez danych osobowych. Pliki klienta zostaną usunięte. Tej operacji NIE MOŻNA cofnąć.`}
          loading={anonymizeLoading}
          onConfirm={handleAnonymize}
          onCancel={() => setAnonymizeContact(null)}
        />
      )}
    </>
  );
}
