-- Bucket na pliki zamowien (PDF, JPG, PNG od klientow)
INSERT INTO storage.buckets (id, name, public) VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS na obiektach Storage: admin moze wszystko, operator moze czytac
CREATE POLICY "admin_storage_order_files" ON storage.objects FOR ALL
  USING (bucket_id = 'order-files' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "operator_read_storage_order_files" ON storage.objects FOR SELECT
  USING (bucket_id = 'order-files' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'operator');
