import { createClient } from "@/lib/supabase/server";
import { MachinesPageClient } from "@/components/machines/machines-page-client";

export default async function MachinesPage() {
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("machine_groups")
    .select("id, name, description, machines(id, name, priority, is_active, notes)")
    .order("name");

  return (
    <div>
      <MachinesPageClient
        groups={(groups ?? []) as unknown as { id: string; name: string; description: string | null; machines: { id: string; name: string; priority: number; is_active: boolean; notes: string | null }[] }[]}
      />
    </div>
  );
}
