-- ============================================================
-- FAZA 2: Status awaiting_approval + tracking + step Projektowanie
-- ============================================================

-- Nowy status: awaiting_approval
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new','confirmed','awaiting_approval','in_production','ready','shipped','delivered','cancelled'));

-- Tracking akceptacji
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_for_approval_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approval_reminder_sent boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_awaiting_approval ON orders(sent_for_approval_at)
  WHERE status = 'awaiting_approval';

-- Seed: workflow step "Projektowanie"
INSERT INTO workflow_steps (name, icon, color)
  VALUES ('Projektowanie', 'palette', '#a855f7')
  ON CONFLICT DO NOTHING;
