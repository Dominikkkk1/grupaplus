"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/orders", label: "Zamowienia", icon: "📦" },
  { href: "/production", label: "Produkcja", icon: "🏭" },
  { href: "/crm", label: "Klienci", icon: "👥" },
  { href: "/products", label: "Produkty", icon: "📋" },
  { href: "/machines", label: "Maszyny", icon: "⚙️" },
];

export function Sidebar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const roleLabel =
    userRole === "admin"
      ? "Administrator"
      : userRole === "operator"
        ? "Operator"
        : "Klient";

  return (
    <aside className="flex w-56 flex-col border-r bg-white">
      {/* Logo */}
      <div className="border-b px-4 py-4">
        <h2 className="text-lg font-bold">Grupa Plus</h2>
        <p className="text-xs text-zinc-500">System produkcyjny</p>
      </div>

      {/* Nawigacja */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith(item.href)
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t p-4">
        <p className="text-sm font-medium truncate">{userName}</p>
        <p className="text-xs text-zinc-500">{roleLabel}</p>
        <button
          onClick={handleLogout}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-900"
        >
          Wyloguj sie
        </button>
      </div>
    </aside>
  );
}
