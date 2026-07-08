-- ============================================================
-- SECURITY: Ograniczenie operator RLS na order_item_progress
-- Operator: SELECT + UPDATE (nie INSERT/DELETE)
-- Admin: ALL (bez zmian)
-- ============================================================

-- Usun stara policy (pelny CRUD dla operatora)
DROP POLICY IF EXISTS operator_all_progress ON order_item_progress;

-- Operator moze CZYTAC
CREATE POLICY operator_read_progress ON order_item_progress FOR SELECT
  USING (public.current_user_role() = 'operator');

-- Operator moze AKTUALIZOWAC (nie INSERT/DELETE)
CREATE POLICY operator_update_progress ON order_item_progress FOR UPDATE
  USING (public.current_user_role() = 'operator');

-- step_order musi byc dodatni
ALTER TABLE product_workflow ADD CONSTRAINT IF NOT EXISTS pw_step_order_positive CHECK (step_order > 0);
ALTER TABLE order_item_progress ADD CONSTRAINT IF NOT EXISTS oip_step_order_positive CHECK (step_order > 0);

-- UNIQUE na order_item_progress (zapobiega duplikatom)
-- (moze juz istniec z poprzedniej migracji)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'oip_item_order_branch_unique'
  ) THEN
    ALTER TABLE order_item_progress ADD CONSTRAINT oip_item_order_branch_unique
      UNIQUE(order_item_id, step_order, branch_type);
  END IF;
END $$;
