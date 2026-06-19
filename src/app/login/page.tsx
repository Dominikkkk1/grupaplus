"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Nieprawidlowy email lub haslo");
      setLoading(false);
      return;
    }

    router.push("/orders");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Lewa strona — branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-zinc-900 p-12 lg:flex">
        <Image
          src="/logo.webp"
          alt="Grupa Plus"
          width={160}
          height={40}
          className="h-10 w-auto brightness-0 invert"
          priority
        />
        <div>
          <h1 className="text-3xl font-bold leading-tight text-white">
            System zarzadzania
            <br />
            produkcja
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
            Kontroluj zamowienia, workflow produkcyjny i komunikacje
            z klientami w jednym miejscu.
          </p>
        </div>
        <p className="text-xs text-zinc-600">
          Drukarnia Grupa Plus &middot; Sanok
        </p>
      </div>

      {/* Prawa strona — formularz */}
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <Image
              src="/logo.webp"
              alt="Grupa Plus"
              width={140}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </div>

          <h2 className="text-xl font-semibold text-zinc-900">
            Zaloguj sie
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Wprowadz dane, aby uzyskac dostep do systemu.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[13px] font-medium text-zinc-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                placeholder="jan@grupa-plus.pl"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[13px] font-medium text-zinc-700"
              >
                Haslo
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 pr-10 text-sm shadow-sm transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Logowanie...
                </span>
              ) : (
                "Zaloguj sie"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
