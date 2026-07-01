-- ============================================================
-- RODO: kolumna anonymized_at na kontaktach
-- ============================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
