import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Jednorazowe linki do akceptacji projektu.
 *
 * Klient drukarni zwykle nie ma konta w systemie (zamowienia przychodza mailem,
 * telefonem albo z Allegro), wiec akceptacja idzie linkiem z tokenem — bez
 * logowania. Token jest jednorazowy i wygasa.
 *
 * Tabeli `approval_tokens` nie czyta zaden zalogowany uzytkownik (RLS bez
 * polityk) — tylko kod serwerowy przez klucz service_role.
 */

/** Po ilu dniach link przestaje dzialac. */
export const TOKEN_VALID_DAYS = 14;

export function generateToken(): string {
  // 32 bajty losowe = praktycznie nie do zgadniecia
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Tworzy nowy link dla zamowienia i uniewaznia poprzednie.
 * Uniewaznianie jest wazne: po wyslaniu POPRAWIONEJ wersji projektu stary link
 * (ze starym projektem) nie moze juz nic zaakceptowac.
 */
export async function createApprovalToken(
  supabase: SupabaseClient,
  orderId: string
): Promise<string> {
  await supabase
    .from("approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .is("used_at", null);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("approval_tokens").insert({
    token,
    order_id: orderId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("[APPROVAL TOKEN] blad zapisu:", error.message);
    throw new Error("Nie udało się utworzyć linku do akceptacji");
  }

  return token;
}

export type TokenCheck =
  | { ok: true; orderId: string }
  | { ok: false; reason: "not_found" | "expired" | "used" };

/** Sprawdza token. Nie zuzywa go — to robi dopiero decyzja klienta. */
export async function checkApprovalToken(
  supabase: SupabaseClient,
  token: string
): Promise<TokenCheck> {
  const { data } = await supabase
    .from("approval_tokens")
    .select("order_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return { ok: false, reason: "not_found" };
  if (data.used_at) return { ok: false, reason: "used" };
  if (new Date(data.expires_at) < new Date()) return { ok: false, reason: "expired" };

  return { ok: true, orderId: data.order_id as string };
}

/** Publiczny adres aplikacji — do budowania linku w mailu. */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "https://grupaplus.vercel.app";
}
