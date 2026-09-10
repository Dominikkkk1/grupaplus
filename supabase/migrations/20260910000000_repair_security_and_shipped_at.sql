-- ============================================================
-- MIGRACJA NAPRAWCZA (10.09.2026)
--
-- Powod: cztery wczesniejsze migracje mialy bledna skladnie
-- (`ADD CONSTRAINT IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS`) i nigdy
-- nie wykonaly sie w calosci. Baza produkcyjna byla latana recznie, wiec
-- nie wiadomo, ktore polityki naprawde istnieja.
--
-- Ta migracja jest IDEMPOTENTNA — mozna ja puscic wielokrotnie i na bazie
-- w dowolnym stanie. Doprowadza produkcje do tego samego stanu, co czysty
-- `supabase db reset`.
--
-- Dodatkowo naprawia blad automatu "wyslane -> dostarczone", ktory liczyl
-- 7 dni od `updated_at` (a to pole zmienia sie przy KAZDEJ edycji zamowienia,
-- np. dopisaniu notatki, wiec licznik sie resetowal).
-- ============================================================

-- ------------------------------------------------------------
-- 1. STORAGE: klient widzi tylko pliki ze SWOICH zamowien
--    (wczesniej: kazdy klient mogl wylistowac caly bucket)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS client_upload_storage_order_files ON storage.objects;
CREATE POLICY client_upload_storage_order_files ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-files'
    AND public.current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.contacts c ON c.id = o.contact_id
      WHERE c.user_id = auth.uid()
        AND o.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

DROP POLICY IF EXISTS client_read_storage_order_files ON storage.objects;
CREATE POLICY client_read_storage_order_files ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-files'
    AND public.current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.contacts c ON c.id = o.contact_id
      WHERE c.user_id = auth.uid()
        AND o.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

-- ------------------------------------------------------------
-- 2. RLS: operator bez INSERT/DELETE na etapach produkcji
-- ------------------------------------------------------------
DROP POLICY IF EXISTS operator_all_progress ON order_item_progress;

DROP POLICY IF EXISTS operator_read_progress ON order_item_progress;
CREATE POLICY operator_read_progress ON order_item_progress FOR SELECT
  USING (public.current_user_role() = 'operator');

DROP POLICY IF EXISTS operator_update_progress ON order_item_progress;
CREATE POLICY operator_update_progress ON order_item_progress FOR UPDATE
  USING (public.current_user_role() = 'operator');

-- ------------------------------------------------------------
-- 3. RLS: klient widzi swoj kontakt i firme (potrzebne do JOIN-ow)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS client_own_contacts ON contacts;
CREATE POLICY client_own_contacts ON contacts FOR SELECT
  USING (public.current_user_role() = 'client' AND user_id = auth.uid());

DROP POLICY IF EXISTS client_read_companies ON companies;
CREATE POLICY client_read_companies ON companies FOR SELECT
  USING (
    public.current_user_role() = 'client' AND EXISTS (
      SELECT 1 FROM orders o
      JOIN contacts c ON c.id = o.contact_id
      WHERE o.company_id = companies.id AND c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. Constrainty, ktore nigdy nie weszly.
--    Jesli w bazie sa juz dane lamiace regule, constraint jest POMIJANY
--    z ostrzezeniem — migracja nigdy nie wywala sie w polowie.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pw_step_order_positive') THEN
    IF EXISTS (SELECT 1 FROM product_workflow WHERE step_order <= 0) THEN
      RAISE WARNING 'POMIJAM pw_step_order_positive — istnieja wiersze ze step_order <= 0';
    ELSE
      ALTER TABLE product_workflow ADD CONSTRAINT pw_step_order_positive CHECK (step_order > 0);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oip_step_order_positive') THEN
    IF EXISTS (SELECT 1 FROM order_item_progress WHERE step_order <= 0) THEN
      RAISE WARNING 'POMIJAM oip_step_order_positive — istnieja wiersze ze step_order <= 0';
    ELSE
      ALTER TABLE order_item_progress ADD CONSTRAINT oip_step_order_positive CHECK (step_order > 0);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oip_item_order_branch_unique') THEN
    IF EXISTS (
      SELECT 1 FROM order_item_progress
      GROUP BY order_item_id, step_order, branch_type HAVING count(*) > 1
    ) THEN
      RAISE WARNING 'POMIJAM oip_item_order_branch_unique — istnieja zduplikowane etapy';
    ELSE
      ALTER TABLE order_item_progress ADD CONSTRAINT oip_item_order_branch_unique
        UNIQUE(order_item_id, step_order, branch_type);
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. shipped_at — moment faktycznej wysylki
--    (automat "po 7 dniach oznacz jako dostarczone" nie moze opierac sie
--    na updated_at, bo to pole rusza sie przy kazdej edycji zamowienia)
-- ------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

-- Backfill: dla juz wyslanych zamowien przyjmujemy updated_at jako przyblizenie
UPDATE orders
   SET shipped_at = updated_at
 WHERE status IN ('shipped', 'delivered')
   AND shipped_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(shipped_at)
  WHERE status = 'shipped';

-- ------------------------------------------------------------
-- 6. Sprzatanie: idx_orders_created_at to duplikat idx_orders_created
--    (ten sam warunek, ta sama kolumna — podwojny koszt przy kazdym zapisie)
-- ------------------------------------------------------------
DROP INDEX IF EXISTS idx_orders_created_at;
