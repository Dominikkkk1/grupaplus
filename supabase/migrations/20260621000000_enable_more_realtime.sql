-- Wlacz Supabase Realtime na dodatkowych tabelach
-- (order_item_progress i orders juz maja realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE order_files;
