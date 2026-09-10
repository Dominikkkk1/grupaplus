-- ============================================================
-- SECURITY: Ograniczenie operator RLS na order_item_progress
-- Operator: SELECT + UPDATE (nie INSERT/DELETE)
-- Admin: ALL (bez zmian)
-- ============================================================

-- Usun stara policy (pelny CRUD dla operatora)
DROP POLICY IF EXISTS operator_all_progress ON order_item_progress;

-- Operator moze CZYTAC
DROP POLICY IF EXISTS operator_read_progress ON order_item_progress;
CREATE POLICY operator_read_progress ON order_item_progress FOR SELECT
  USING (public.current_user_role() = 'operator');

-- Operator moze AKTUALIZOWAC (nie INSERT/DELETE)
DROP POLICY IF EXISTS operator_update_progress ON order_item_progress;
CREATE POLICY operator_update_progress ON order_item_progress FOR UPDATE
  USING (public.current_user_role() = 'operator');

-- ============================================================
-- Constrainty.
-- UWAGA: Postgres NIE zna skladni `ADD CONSTRAINT IF NOT EXISTS`
-- (to byl blad, przez ktory cala ta migracja sie nie wykonywala).
-- Dlatego kazdy constraint dodajemy w bloku DO z recznym sprawdzeniem.
-- ============================================================

-- step_order musi byc dodatni
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pw_step_order_positive') THEN
    ALTER TABLE product_workflow ADD CONSTRAINT pw_step_order_positive CHECK (step_order > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oip_step_order_positive') THEN
    ALTER TABLE order_item_progress ADD CONSTRAINT oip_step_order_positive CHECK (step_order > 0);
  END IF;
END $$;

-- UNIQUE na order_item_progress (zapobiega duplikatom etapow)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oip_item_order_branch_unique') THEN
    ALTER TABLE order_item_progress ADD CONSTRAINT oip_item_order_branch_unique
      UNIQUE(order_item_id, step_order, branch_type);
  END IF;
END $$;
