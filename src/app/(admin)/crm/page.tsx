import { createClient } from "@/lib/supabase/server";
import { CrmPageClient } from "@/components/crm/crm-page-client";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, nip, address, notes, contacts(id)")
    .order("name");

  const { data: privateContacts } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, is_primary, is_blacklisted")
    .is("company_id", null)
    .order("full_name");

  return (
    <div>
      <CrmPageClient
        companies={(companies ?? []) as unknown as { id: string; name: string; nip: string | null; address: string | null; notes: string | null; contacts: { id: string }[] }[]}
        privateContacts={(privateContacts ?? []) as unknown as { id: string; full_name: string; email: string | null; phone: string | null; is_primary: boolean; is_blacklisted: boolean }[]}
      />
    </div>
  );
}
