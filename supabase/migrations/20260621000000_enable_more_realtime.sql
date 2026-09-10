-- Wlacz Supabase Realtime na dodatkowych tabelach
-- (order_item_progress i orders juz maja realtime)
--
-- UWAGA: `ALTER PUBLICATION ... ADD TABLE` wywala sie bledem, jesli tabela juz
-- jest w publikacji. Bez tego zabezpieczenia ponowne uruchomienie migracji
-- (albo `supabase db push` na bazie, ktora juz to ma) konczy sie bledem.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'complaints'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_files;
  END IF;
END $$;
