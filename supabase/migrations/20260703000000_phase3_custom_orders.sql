-- ============================================================
-- FAZA 3: Delivery type (wysylka vs odbior osobisty)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'shipping'
  CHECK (delivery_type IN ('shipping', 'pickup'));
