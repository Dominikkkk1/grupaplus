-- Klient moze uploadowac i czytac pliki ze swoich zamowien
CREATE POLICY IF NOT EXISTS client_upload_storage_order_files ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-files' AND
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'client'
  );

CREATE POLICY IF NOT EXISTS client_read_storage_order_files ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-files' AND
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'client'
  );
