-- Indeksy na najczęściej odpytywane kolumny
-- Brakujące indeksy wykryte podczas audytu kodu

-- orders: filtrowanie po statusie, sortowanie po dacie, lookup po kontakcie
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_contact ON orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_deadline ON orders(deadline) WHERE deadline IS NOT NULL;

-- order_items: JOIN z orders
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- order_item_progress: tablica produkcyjna, skanowanie
CREATE INDEX IF NOT EXISTS idx_progress_item ON order_item_progress(order_item_id);
CREATE INDEX IF NOT EXISTS idx_progress_step ON order_item_progress(step_id);
CREATE INDEX IF NOT EXISTS idx_progress_status ON order_item_progress(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_progress_started_by ON order_item_progress(started_by) WHERE status = 'in_progress';

-- contacts: lookup po email i user_id (RLS klienta)
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id) WHERE company_id IS NOT NULL;

-- products: matching po SKU (WooCommerce webhook)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- complaints: filtrowanie po statusie
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status) WHERE status IN ('open', 'in_progress');
