import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Pobierz profil z rola
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={profile?.full_name ?? user.email ?? ""}
        userRole={profile?.role ?? "operator"}
      />
      <main className="flex-1 overflow-auto bg-zinc-50 p-6">
        {children}
      </main>
    </div>
  );
}
