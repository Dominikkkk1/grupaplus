"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Package,
  Factory,
  Users,
  ClipboardList,
  Cog,
  Calculator,
  ScanLine,
  LogOut,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/orders", label: "Zamowienia", icon: Package, roles: ["admin", "operator", "client"] },
  { href: "/production", label: "Produkcja", icon: Factory, roles: ["admin", "operator"] },
  { href: "/scan", label: "Skanowanie", icon: ScanLine, roles: ["admin", "operator"] },
  { href: "/crm", label: "Klienci", icon: Users, roles: ["admin"] },
  { href: "/products", label: "Produkty", icon: ClipboardList, roles: ["admin"] },
  { href: "/machines", label: "Maszyny", icon: Cog, roles: ["admin"] },
  { href: "/calculator", label: "Kalkulator", icon: Calculator, roles: ["admin"] },
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
    <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white print:hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
        <Image
          src="/logo.webp"
          alt="Grupa Plus"
          width={120}
          height={32}
          className="h-8 w-auto"
          priority
        />
      </div>

      {/* Nawigacja */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Menu
        </p>
        {NAV_ITEMS.filter((item) => item.roles.includes(userRole)).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                className={cn(
                  isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-600"
                )}
              />
              {item.label}
              {isActive && (
                <ChevronRight size={14} className="ml-auto text-zinc-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-zinc-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-medium text-zinc-900">
              {userName}
            </p>
            <p className="text-[11px] text-zinc-400">{roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Wyloguj"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
