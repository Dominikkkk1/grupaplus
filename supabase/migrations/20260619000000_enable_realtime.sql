-- Wlacz Supabase Realtime dla tabel produkcyjnych
-- Panel produkcji nasluchuje zmian w order_item_progress (statusy etapow)
-- Panel zamowien nasluchuje nowych zamowien
ALTER PUBLICATION supabase_realtime ADD TABLE order_item_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
