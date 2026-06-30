# Zestawienie prac — System MES + CRM dla drukarni

**Data:** 26.06.2026
**Okres realizacji:** 18.06.2026 – 25.06.2026
**Wykonawca:** _____________________
**Zleceniodawca:** _____________________

---

## 1. Zakres projektu

Zaprojektowanie i wdrożenie systemu do zarządzania produkcją (MES) z modułem CRM,
zintegrowanego z WooCommerce, obsługą plików produkcyjnych i automatycznymi powiadomieniami.

---

## 2. Szczegółowy breakdown prac

### 2.1 Architektura i konfiguracja środowiska — 10h

| Zadanie | Opis |
|---|---|
| Projekt architektury | Dobór stacku technologicznego, schemat modułów, przepływ danych |
| Setup Next.js + Tailwind + shadcn/ui | Konfiguracja frontendu z komponentami UI |
| Konfiguracja Supabase | Baza danych PostgreSQL, autentykacja, storage, realtime |
| Deploy pipeline | Vercel (frontend) + Railway (mikroserwis Python) |
| Middleware + autoryzacja | Zabezpieczenie endpointów, role-based access (admin/operator/klient) |

### 2.2 Baza danych — 10h

| Zadanie | Opis |
|---|---|
| Schemat relacyjny | Tabele: orders, order_items, products, contacts, companies, machines, workflow_steps, complaints |
| 9 migracji SQL | Schemat bazowy, indeksy, unikalne constrainty, pola skanowania, storage bucket, realtime |
| Row Level Security (RLS) | Polityki bezpieczeństwa na poziomie wierszy dla 3 ról |
| Junction tables | product_workflow, order_item_progress — konfigurowalne workflow produkcyjne |

### 2.3 Backend API — 16h

| Moduł | Endpointy | Opis |
|---|---|---|
| Zamówienia | CRUD + statusy | Tworzenie, edycja, usuwanie, zmiana statusów, filtrowanie |
| Produkty | CRUD + workflow | Zarządzanie produktami z przypisywaniem etapów produkcji |
| Kontakty | CRUD | Baza klientów z powiązaniem do firm |
| Firmy | CRUD | Zarządzanie firmami (CRM) |
| Maszyny | CRUD + grupy | Zarządzanie parkiem maszynowym z grupami stanowisk |
| Użytkownicy | CRUD + role | Panel zarządzania użytkownikami z rolami |
| Etapy workflow | CRUD | Definiowanie etapów produkcji (druk, krojenie, pakowanie, itp.) |
| Skanowanie QR | POST /api/scan | Rejestracja postępu produkcji przez skan kodów QR |
| Webhook WooCommerce | POST + HMAC | Automatyczny import zamówień z walidacją podpisu |
| Pliki produkcyjne | Upload/delete + preflight | Upload z walidacją techniczną plików |
| Cron jobs | 2 endpointy | Automatyczne czyszczenie + monitoring terminów |

### 2.4 Frontend — 28h

| Moduł | Strony | Opis |
|---|---|---|
| Dashboard | 1 | Statystyki: zamówienia, przychód, statusy, wykres dzienny |
| Zamówienia | 3 | Lista z filtrami, szczegóły zamówienia, widok do druku |
| Produkty | 2 | Lista produktów, edycja z builderem workflow |
| CRM | 3 | Lista firm/kontaktów, szczegóły firmy, generowanie ofert |
| Produkcja | 1 | Tablica kanban z kartami zadań, operator + maszyna |
| Skanowanie QR | 1 | Mobilny widok skanowania z wyborem stanowiska |
| Maszyny | 1 | Zarządzanie maszynami i grupami |
| Ustawienia | 1 | Panel użytkowników z rolami |
| Kalkulator | 1 | Kalkulator wycen |
| Login | 1 | Strona logowania |
| Widok klienta | 1 | Dedykowany widok zamówienia dla klienta końcowego |
| **Responsywność** | — | Pełna obsługa mobile + tablet (sidebar, tabele, karty) |

### 2.5 Mikroserwis preflight (Python) — 10h

| Sprawdzenie | Opis |
|---|---|
| DPI | Walidacja rozdzielczości (min. 150, zalecane 300) |
| Profil kolorów | Wykrywanie CMYK/RGB z zaleceniami konwersji |
| Profil ICC | Odczyt osadzonego profilu ICC |
| Wymiary | Obliczanie wymiarów fizycznych (mm) z DPI |
| Proporcje | Porównanie z docelowym rozmiarem produktu (5% tolerancja) |
| Przeźroczystość | Wykrywanie warstw alpha w PDF |
| Czcionki | Wykrywanie nieosadzonych czcionek Type3 |
| Obsługiwane formaty | JPG, PNG, TIFF, PDF (do 50 MB) |

### 2.6 Integracje i automatyzacje — 8h

| Element | Opis |
|---|---|
| WooCommerce webhook | Automatyczny import zamówień z adapter pattern |
| Email (Resend) | Powiadomienia o statusie zamówienia, szablony HTML |
| Auto-status | Automatyczna zmiana statusów (ready → in_production → shipped) |
| Realtime | Live aktualizacje tablic produkcji przez Supabase Realtime |
| Cron: deadlines | Monitoring zbliżających się terminów realizacji |
| Cron: cleanup | Automatyczne czyszczenie danych tymczasowych |

### 2.7 Bezpieczeństwo i jakość — 6h

| Element | Opis |
|---|---|
| HMAC webhooks | Walidacja podpisów WooCommerce |
| HTML escaping | Ochrona przed XSS w emailach i formularzach |
| Walidacja plików | Typ, rozmiar, sanityzacja nazw |
| RLS | Row Level Security na wszystkich tabelach |
| Error handling | Obsługa błędów upload, timeout, memory leak |

### 2.8 UX, testy, bugfixy, deploy — 12h

| Element | Opis |
|---|---|
| Polskojęzyczny UI | Tłumaczenie całego interfejsu (37 plików) |
| Bugfixy | 11+ naprawionych bugów produkcyjnych |
| UX polish | Sortowanie, badge'y, mobilna nawigacja, widok druku |
| Deploy i monitoring | Konfiguracja Vercel + Railway, env vars, redeploy |

---

## 3. Podsumowanie

| | |
|---|---|
| **Łączna liczba godzin** | **100h** |
| **Stawka godzinowa** | **140 zł netto** |
| **Kwota netto** | **14 000 zł** |

---

## 4. Dostarczone elementy

- Działająca aplikacja webowa (produkcja) z adresem na Vercel
- Baza danych PostgreSQL (Supabase) z pełnym schematem
- Mikroserwis preflight (Railway) do walidacji plików produkcyjnych
- Integracja z WooCommerce (automatyczny import zamówień)
- System powiadomień email (Resend)
- Responsywny interfejs (desktop + tablet + mobile)
- Panel skanowania QR dla operatorów produkcji

---

## 5. Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 16, React, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (serverless) |
| Baza danych | PostgreSQL (Supabase) |
| Autentykacja | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Preflight | Python, FastAPI, PyMuPDF, Pillow |
| Email | Resend |
| Hosting frontend | Vercel |
| Hosting mikroserwis | Railway |

---

*Dokument wygenerowany na podstawie repozytorium projektu (57 commitów, 13 000+ linii kodu).*
