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

## Deweloper
- Poczatkujacy — wyjasniaj decyzje, ostrzegaj przed pulapkami
- Preferowany jezyk: polski
