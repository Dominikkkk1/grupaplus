-- ============================================================
-- FAZA 1: Prefiksy numeracji, priorytet, lead time, czarna lista
-- ============================================================

-- A. Priority flag na zamowieniach
ALTER TABLE orders ADD COLUMN is_priority boolean NOT NULL DEFAULT false;
CREATE INDEX idx_orders_priority ON orders(is_priority) WHERE is_priority = true;

-- B. Lead time na produktach (dni robocze)
ALTER TABLE products ADD COLUMN lead_time_days integer;

-- C. Czarna lista kontaktow
ALTER TABLE contacts ADD COLUMN is_blacklisted boolean NOT NULL DEFAULT false;

-- D. Prefiksy numeracji zamowien wg zrodla
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix text;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    prefix := CASE NEW.source
      WHEN 'allegro'     THEN 'AL'
      WHEN 'stacjonarne' THEN 'LOK'
      WHEN 'woo'         THEN 'SHOP'
      WHEN 'email'       THEN 'EM'
      WHEN 'baselinker'  THEN 'BL'
      ELSE 'GP'
    END;
    NEW.order_number = prefix || '-' || to_char(now(), 'YYMMDD') || '-' ||
      lpad(nextval('order_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
