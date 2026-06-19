-- Pola do logowania skanowania QR na stacjach roboczych
-- started_at: kiedy operator rozpoczal prace nad tym etapem
-- started_by: ktory operator rozpoczal
ALTER TABLE order_item_progress ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE order_item_progress ADD COLUMN IF NOT EXISTS started_by uuid REFERENCES users(id) ON DELETE SET NULL;
