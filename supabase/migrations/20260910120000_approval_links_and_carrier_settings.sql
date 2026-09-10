-- ============================================================
-- 1. GODZINY ODBIORU PRZEWOZNIKOW (edytowalne w aplikacji)
--
-- Godzin nie zaszywamy w kodzie — Grupa Plus ma je zmieniac sama,
-- bez proszenia programiste i bez wdrozenia.
-- ============================================================

CREATE TABLE IF NOT EXISTS carrier_settings (
  carrier text PRIMARY KEY,
  pickup_time time,                 -- godzina odbioru, np. 16:00
  notes text,                       -- np. "kurier dzwoni 15 min wczesniej"
  updated_at timestamptz DEFAULT now()
);

-- Wiersz na kazdego przewoznika ze slownika, godziny puste do uzupelnienia
INSERT INTO carrier_settings (carrier)
VALUES ('inpost'), ('dpd'), ('dhl'), ('gls'), ('poczta'), ('ups'), ('fedex'), ('inny')
ON CONFLICT (carrier) DO NOTHING;

ALTER TABLE carrier_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_carrier_settings ON carrier_settings;
CREATE POLICY admin_all_carrier_settings ON carrier_settings FOR ALL
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS operator_read_carrier_settings ON carrier_settings;
CREATE POLICY operator_read_carrier_settings ON carrier_settings FOR SELECT
  USING (public.current_user_role() = 'operator');

-- ============================================================
-- 2. LINKI DO AKCEPTACJI PROJEKTU
--
-- Klient drukarni najczesciej NIE MA konta w systemie (zamowienia ida mailem,
-- telefonem, z Allegro). Dlatego akceptacja idzie przez jednorazowy link
-- z tokenem, bez logowania.
--
-- Tabela NIE MA zadnej polityki RLS = zaden zalogowany uzytkownik jej nie
-- czyta. Dostep ma wylacznie kod serwerowy przez klucz service_role, ktory
-- sam sprawdza waznosc tokenu.
--
-- Token trzymamy w postaci jawnej swiadomie: ma krotki termin waznosci,
-- jest jednorazowy, a kto ma dostep do bazy, ten i tak moze zmienic status
-- zamowienia bezposrednio.
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_tokens (
  token text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  decision text CHECK (decision IN ('approved', 'changes_requested')),
  comment text
);

CREATE INDEX IF NOT EXISTS idx_approval_tokens_order ON approval_tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_active ON approval_tokens(expires_at)
  WHERE used_at IS NULL;

ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;
-- celowo bez polityk: tylko service_role

-- Slad po decyzji klienta na samym zamowieniu (do podgladu w karcie zamowienia)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_decision text
  CHECK (approval_decision IS NULL OR approval_decision IN ('approved', 'changes_requested'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_comment text;
