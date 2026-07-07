-- ============================================================
-- FORK/JOIN: Rozgaleziony workflow dla ksiazek/broszur
-- ============================================================

-- 1. branch_type na product_workflow
ALTER TABLE product_workflow ADD COLUMN IF NOT EXISTS branch_type text NOT NULL DEFAULT 'common'
  CHECK (branch_type IN ('common', 'branch_a', 'branch_b'));

-- 2. Zmien unique constraint: step_order unikatowy per branch, nie globalnie
ALTER TABLE product_workflow DROP CONSTRAINT IF EXISTS product_workflow_product_id_step_order_key;
ALTER TABLE product_workflow ADD CONSTRAINT product_workflow_product_branch_order_key
  UNIQUE(product_id, step_order, branch_type);

-- Usun tez unique(product_id, step_id) bo ten sam step moze byc w obu branchach
ALTER TABLE product_workflow DROP CONSTRAINT IF EXISTS product_workflow_product_id_step_id_key;
ALTER TABLE product_workflow ADD CONSTRAINT product_workflow_product_step_branch_key
  UNIQUE(product_id, step_id, branch_type);

-- 3. branch_type na order_item_progress
ALTER TABLE order_item_progress ADD COLUMN IF NOT EXISTS branch_type text NOT NULL DEFAULT 'common'
  CHECK (branch_type IN ('common', 'branch_a', 'branch_b'));

-- 4. Update trigger: kopiuj branch_type z product_workflow
CREATE OR REPLACE FUNCTION create_progress_for_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO order_item_progress (order_item_id, step_id, step_order, branch_type)
    SELECT NEW.id, pw.step_id, pw.step_order, pw.branch_type
    FROM product_workflow pw
    WHERE pw.product_id = NEW.product_id
    ORDER BY pw.branch_type, pw.step_order;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
