-- ============================================================
-- Klient moze uploadowac i czytac pliki — ale TYLKO ze swoich zamowien
--
-- Dwa bledy w pierwotnej wersji tej migracji:
--  1. `CREATE POLICY IF NOT EXISTS` — taka skladnia w Postgresie nie istnieje,
--     wiec migracja w ogole sie nie wykonywala.
--  2. Warunek sprawdzal tylko role 'client', bez powiazania z zamowieniem —
--     czyli kazdy zalogowany klient mogl wylistowac CALY bucket i pobrac
--     cudze projekty graficzne.
--
-- Sciezka pliku ma format `<order_id>/<timestamp>-<nazwa>`, wiec pierwszy
-- segment nazwy obiektu porownujemy z id zamowienia klienta.
-- ============================================================

DROP POLICY IF EXISTS client_upload_storage_order_files ON storage.objects;
CREATE POLICY client_upload_storage_order_files ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-files'
    AND public.current_user_role() = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
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
      SELECT 1
      FROM public.orders o
      JOIN public.contacts c ON c.id = o.contact_id
      WHERE c.user_id = auth.uid()
        AND o.id::text = split_part(storage.objects.name, '/', 1)
    )
  );
