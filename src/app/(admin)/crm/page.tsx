import { createClient } from "@/lib/supabase/server";
import { Users, Plus, Search, Building2, User } from "lucide-react";

export default async function CrmPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("*, contacts(id)")
    .order("name");

  const { data: privateContacts } = await supabase
    .from("contacts")
    .select("*")
    .is("company_id", null)
    .order("full_name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Klienci</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Firmy i osoby prywatne
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
          <Plus size={16} />
          Dodaj firme
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Szukaj po nazwie, NIP..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>

      {/* Firmy */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
          <Building2 size={14} />
          Firmy ({companies?.length ?? 0})
        </h2>
        {companies && companies.length > 0 ? (
          <div className="space-y-2">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
                    <Building2 size={16} className="text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-900">
                      {company.name}
                    </p>
                    <p className="text-[12px] text-zinc-500">
                      {company.nip ? `NIP: ${company.nip}` : "Brak NIP"}
                      {company.address && ` · ${company.address}`}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[12px] font-medium text-zinc-600">
                  {(company.contacts as { id: string }[])?.length ?? 0} kontaktow
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="text-[13px] text-zinc-500">Brak firm w systemie</p>
          </div>
        )}
      </div>

      {/* Kontakty prywatne */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
          <User size={14} />
          Klienci prywatni ({privateContacts?.length ?? 0})
        </h2>
        {privateContacts && privateContacts.length > 0 ? (
          <div className="space-y-2">
            {privateContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
                  <User size={16} className="text-zinc-500" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-900">
                    {contact.full_name}
                  </p>
                  <p className="text-[12px] text-zinc-500">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ") || "Brak danych"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <p className="text-[13px] text-zinc-500">
              Klienci prywatni pojawia sie po przyjsciu zamowien
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
