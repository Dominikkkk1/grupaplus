-- Brakujace indeksy (z audytu)
CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_complaints_order ON complaints(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned ON orders(assigned_to) WHERE assigned_to IS NOT NULL;
