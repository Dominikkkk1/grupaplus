# System MES + mini-CRM — Drukarnia Grupa Plus

## Stack
- Next.js 15 (App Router) + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Storage + Realtime)
- Zapytania: Supabase JS client (NIE Prisma — RLS w SQL, Realtime natywne)
- Deploy: Vercel

## Zasady
- Sekrety w env vars (Vercel), NIGDY w repo
- Webhooks: ZAWSZE zapisz surowy payload do webhook_events PRZED przetworzeniem
- Walidacja HMAC na webhookach (WooCommerce consumer secret)
- Idempotentnosc: sprawdzaj external_id, nie twórz duplikatów
- RLS od poczatku — 3 role: admin, operator, client
- Supabase admin client (service_role) TYLKO w server-side code

## Architektura zamówień
- Adapter pattern: kazde zrodlo mapuje na OrderInput (src/lib/adapters/types.ts)
- Etap 2: WooCommerce webhook bezposrednio
- Etap 3: BaseLinker (Allegro + WooCommerce)
- Zamówienia reczne: formularz admina, source 'email'|'stacjonarne'

## Kluczowe decyzje
- Allegro koduje maile → contacts.allegro_login jako identyfikator
- Konfigurowalne workflow → product_workflow (junction table z step_order)
- Duze pliki produkcyjne zostaja na NAS (internet 50/50 Mb/s)
- Klient widzi 3 statusy, zespol widzi szczegolowe etapy

## Pulapki (wykryte 10.09.2026 — NIE powtarzac)
- `public.users` NIE MA kolumny `email`. Adres jest w `auth.users`, tylko przez Admin API.
  Zawsze uzywaj `src/lib/email/recipients.ts`. Zapytanie `.from("users").select("email")`
  zwraca blad 42703, `data` = null i wysylka po cichu nie dochodzi.
- `src/types/database.ts` jest nieaktualny i NIEUZYWANY — klienci Supabase sa nietypowane,
  wiec TypeScript nie wylapie zlej nazwy kolumny. Bledy tego typu wychodza dopiero na produkcji.
- Postgres NIE zna `ADD CONSTRAINT IF NOT EXISTS` ani `CREATE POLICY IF NOT EXISTS`.
  Uzywaj `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) $$` oraz
  `DROP POLICY IF EXISTS` + `CREATE POLICY`. Cztery migracje przez to nigdy sie nie wykonaly.
- `ALTER PUBLICATION ... ADD TABLE` wywala sie, gdy tabela juz jest w publikacji — opakowac w DO.
- HISTORIA MIGRACJI BYLA ROZJECHANA: baze migrowano przez dashboard/MCP pod innymi numerami
  niz pliki w repo. Naprawione 10.09 (wszystkie wersje z repo sa w `schema_migrations`).
  Przed `supabase db push` ZAWSZE porownaj `schema_migrations` z plikami.
- Sciezka pliku w Storage to `<order_id>/<timestamp>-<nazwa>` — polityki RLS opieraja sie
  na `split_part(name,'/',1)`. Nie zmieniac formatu sciezki bez poprawienia polityk.
- Bezposredni DELETE z `storage.objects` jest zablokowany triggerem — uzywaj Storage API.
- Produkcyjny Supabase to darmowy plan: po tygodniu bezczynnosci projekt jest usypiany
  i jego host przestaje sie rozwiazywac (NXDOMAIN). Trzeba go wznowic w panelu.

## Deweloper
- Poczatkujacy — wyjasniaj decyzje, ostrzegaj przed pulapkami
- Preferowany jezyk: polski
