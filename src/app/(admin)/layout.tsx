import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { canAccess, DEFAULT_ROUTE } from "@/lib/route-access";
import { approvalCutoffISO } from "@/lib/approval";

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
    .maybeSingle();

  // Brak profilu = najmniejsze uprawnienia (klient), nie operator.
  const role = profile?.role ?? "client";

  // Twarda kontrola dostepu. Sidebar chowa linki, ale to tylko kosmetyka —
  // realna blokada jest tutaj, bo adres mozna wpisac recznie.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname && !canAccess(pathname, role)) {
    console.warn("[ACCESS] rola %s bez dostepu do %s — redirect", role, pathname);
    redirect(DEFAULT_ROUTE);
  }

  // Powiadomienie dla pracownika: projekty wyslane do klienta, na ktore od
  // ponad 24 h nie ma odpowiedzi. Liczymy przy renderze — nie potrzeba do tego
  // crona, a licznik jest zawsze aktualny.
  let approvalAlerts = 0;
  if (role === "admin" || role === "operator") {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_approval")
      .not("sent_for_approval_at", "is", null)
      .lt("sent_for_approval_at", approvalCutoffISO());
    approvalAlerts = count ?? 0;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={profile?.full_name ?? user.email ?? ""}
        userRole={role}
        approvalAlerts={approvalAlerts}
      />
      <main className="flex-1 overflow-auto bg-zinc-50 px-4 pb-6 pt-[68px] md:p-6 print:bg-white print:p-0">
        {children}
      </main>
    </div>
  );
}
