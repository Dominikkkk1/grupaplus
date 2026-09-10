import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pobieranie adresow e-mail uzytkownikow.
 *
 * UWAGA — pulapka, na ktorej ten projekt juz raz polegl:
 * tabela `public.users` NIE MA kolumny `email`. Adres siedzi w `auth.users`,
 * czyli w systemowej tabeli logowania Supabase, dostepnej wylacznie przez
 * Admin API (klucz service_role).
 *
 * Zapytanie `.from("users").select("email")` konczy sie bledem PostgREST,
 * `data` wraca jako `null`, lista odbiorcow wychodzi pusta i wysylka po cichu
 * nie dochodzi do skutku. Zawsze uzywaj funkcji z tego pliku.
 */

const PER_PAGE = 1000;
const MAX_PAGES = 20;

/** Mapa: id uzytkownika -> e-mail (z auth.users). */
export async function loadAuthEmails(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const map = new Map<string, string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (error) {
      console.error("[EMAIL] blad pobierania uzytkownikow z auth:", error.message);
      break;
    }

    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email) map.set(u.id, u.email);
    }

    if (users.length < PER_PAGE) break;
  }

  return map;
}

/** Adresy aktywnych administratorow. */
export async function getActiveAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();

  const { data: admins, error } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) {
    console.error("[EMAIL] blad pobierania adminow:", error.message);
    return [];
  }

  if (!admins || admins.length === 0) {
    console.warn("[EMAIL] brak aktywnych adminow w bazie");
    return [];
  }

  const emails = await loadAuthEmails();
  const result = admins
    .map((a) => emails.get(a.id as string))
    .filter((e): e is string => !!e);

  if (result.length === 0) {
    console.warn(
      "[EMAIL] zaden z %d adminow nie ma adresu e-mail w auth.users",
      admins.length
    );
  }

  return result;
}

/** Adres e-mail pojedynczego uzytkownika. */
export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error) {
    console.error("[EMAIL] blad pobierania usera %s: %s", userId, error.message);
    return null;
  }

  return data?.user?.email ?? null;
}
