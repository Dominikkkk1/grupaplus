-- ============================================================
-- FUNKCJA 2: przypomnienie o braku akceptacji projektu po 24 h
--
-- Co juz bylo: status `awaiting_approval`, `sent_for_approval_at`,
-- `approval_reminder_sent`.
-- Czego brakowalo:
--  - licznika ponownych wysylek (po poprawce zegar 24 h startuje od nowa),
--  - momentu akceptacji (dotad nigdzie nie zapisywanego).
-- ============================================================

-- Ile razy wyslano klientowi poprawiona wersje projektu
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_resent_count integer NOT NULL DEFAULT 0;

-- Kiedy klient zaakceptowal projekt (wyjscie ze statusu awaiting_approval "w przod")
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Indeks pod wyszukiwanie przeterminowanych akceptacji.
-- (idx_orders_awaiting_approval z migracji phase2 juz pokrywa ten warunek,
--  wiec tworzymy tylko, jesli go nie ma)
CREATE INDEX IF NOT EXISTS idx_orders_awaiting_approval ON orders(sent_for_approval_at)
  WHERE status = 'awaiting_approval';
