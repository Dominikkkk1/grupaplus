-- ============================================================
-- Poprawki schematu po audycie
-- ============================================================

-- A. Brakujacy workflow dla Plakat A1 (duzy format)
-- UWAGA: te dane pochodza z seed.sql, ktory w `supabase db reset` wykonuje sie
-- PO migracjach. Dlatego wstawiamy warunkowo — jesli produktu/etapu jeszcze nie ma,
-- wiersz jest pomijany (seed.sql i tak zawiera te same dane).
INSERT INTO product_workflow (product_id, step_id, step_order)
SELECT v.product_id, v.step_id, v.step_order
FROM (VALUES
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 1),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000003'::uuid, 2),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000005'::uuid, 3),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'b0000000-0000-0000-0000-000000000011'::uuid, 4)
) AS v(product_id, step_id, step_order)
WHERE EXISTS (SELECT 1 FROM products p WHERE p.id = v.product_id)
  AND EXISTS (SELECT 1 FROM workflow_steps w WHERE w.id = v.step_id)
ON CONFLICT DO NOTHING;

-- B. RLS: operator musi widziec contacts i companies
DROP POLICY IF EXISTS operator_read_contacts ON contacts;
CREATE POLICY operator_read_contacts ON contacts FOR SELECT
  USING (public.current_user_role() = 'operator');

DROP POLICY IF EXISTS operator_read_companies ON companies;
CREATE POLICY operator_read_companies ON companies FOR SELECT
  USING (public.current_user_role() = 'operator');

-- C. Walidacja: step musi nalezec do workflow produktu
CREATE OR REPLACE FUNCTION check_progress_step_valid()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT product_id FROM order_items WHERE id = NEW.order_item_id) IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM product_workflow pw
    JOIN order_items oi ON pw.product_id = oi.product_id
    WHERE oi.id = NEW.order_item_id AND pw.step_id = NEW.step_id
  ) THEN
    RAISE EXCEPTION 'Step nie jest w workflow produktu dla tego order_item';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_progress_step ON order_item_progress;
CREATE TRIGGER trg_check_progress_step
  BEFORE INSERT OR UPDATE ON order_item_progress
  FOR EACH ROW EXECUTE FUNCTION check_progress_step_valid();

-- D. Optymalizacja RLS client (EXISTS zamiast IN)
DROP POLICY IF EXISTS client_own_orders ON orders;
CREATE POLICY client_own_orders ON orders FOR SELECT USING (
  public.current_user_role() = 'client'
  AND EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.user_id = auth.uid() AND c.id = orders.contact_id
  )
);

DROP POLICY IF EXISTS client_own_items ON order_items;
CREATE POLICY client_own_items ON order_items FOR SELECT USING (
  public.current_user_role() = 'client'
  AND EXISTS (
    SELECT 1 FROM orders o
    JOIN contacts c ON c.id = o.contact_id
    WHERE o.id = order_items.order_id AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS client_own_files ON order_files;
CREATE POLICY client_own_files ON order_files FOR SELECT USING (
  public.current_user_role() = 'client'
  AND EXISTS (
    SELECT 1 FROM orders o
    JOIN contacts c ON c.id = o.contact_id
    WHERE o.id = order_files.order_id AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS client_upload_files ON order_files;
CREATE POLICY client_upload_files ON order_files FOR INSERT WITH CHECK (
  public.current_user_role() = 'client'
  AND EXISTS (
    SELECT 1 FROM orders o
    JOIN contacts c ON c.id = o.contact_id
    WHERE o.id = order_files.order_id AND c.user_id = auth.uid()
  )
);
