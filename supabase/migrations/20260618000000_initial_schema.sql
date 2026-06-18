-- ============================================================
-- System MES + mini-CRM — Drukarnia Grupa Plus
-- Migracja: schemat poczatkowy
-- ============================================================

-- 0. HELPERY
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. UZYTKOWNICY (rozszerza Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'operator'
    CHECK (role IN ('admin', 'operator', 'client')),
  card_uid text UNIQUE,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. CRM: FIRMY + KONTAKTY
-- ============================================================
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nip text UNIQUE,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  is_primary boolean DEFAULT false,
  allegro_login text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. PRODUKTY + MASZYNY
-- ============================================================
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category text,
  description text,
  base_price numeric(10, 2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE machine_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES machine_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. KONFIGUROWALNY WORKFLOW
-- ============================================================
CREATE TABLE workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  machine_group_id uuid REFERENCES machine_groups(id) ON DELETE SET NULL,
  icon text,
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE product_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  is_required boolean DEFAULT true,
  UNIQUE(product_id, step_id),
  UNIQUE(product_id, step_order)
);

-- ============================================================
-- 5. ZAMOWIENIA
-- ============================================================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  source text NOT NULL
    CHECK (source IN ('allegro', 'woo', 'email', 'stacjonarne', 'baselinker')),
  external_id text,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled')),
  payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'cod', 'refunded')),
  deadline timestamptz,
  shipping_method text,
  tracking_number text,
  notes text,
  total_price numeric(10, 2),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Idempotentnosc webhookow: jeden external_id per source
CREATE UNIQUE INDEX idx_orders_source_external
  ON orders(source, external_id)
  WHERE external_id IS NOT NULL;

-- Auto-generowanie order_number (GP-RRMMDD-NNN)
CREATE SEQUENCE order_number_seq;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number = 'GP-' || to_char(now(), 'YYMMDD') || '-' ||
      lpad(nextval('order_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_number BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- 6. POZYCJE ZAMOWIENIA
-- ============================================================
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10, 2),
  specifications jsonb DEFAULT '{}',
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_order_items_updated BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. POSTEP PRODUKCJI (checklista per pozycja)
-- ============================================================
CREATE TABLE order_item_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES workflow_steps(id),
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'rework')),
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES machines(id) ON DELETE SET NULL,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Automatyczne tworzenie progress rekordow gdy dodaje sie order_item z product_id
CREATE OR REPLACE FUNCTION create_progress_for_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO order_item_progress (order_item_id, step_id, step_order)
    SELECT NEW.id, pw.step_id, pw.step_order
    FROM product_workflow pw
    WHERE pw.product_id = NEW.product_id
    ORDER BY pw.step_order;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_progress
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION create_progress_for_item();

-- ============================================================
-- 8. PLIKI ZAMOWIENIA
-- ============================================================
CREATE TABLE order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  preflight_status text
    CHECK (preflight_status IN ('pending', 'passed', 'warning', 'failed')),
  preflight_result jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 9. REKLAMACJE / INCYDENTY
-- ============================================================
CREATE TABLE complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('internal', 'external')),
  reason text NOT NULL,
  revert_to_step_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
  reprint_quantity integer,
  status text DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'rejected')),
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 10. WEBHOOK EVENTS (surowe payloady)
-- ============================================================
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  error text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 11. RLS (Row Level Security)
-- ============================================================

-- Helper: rola zalogowanego usera
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Wlacz RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ADMIN: pelny dostep do wszystkiego
CREATE POLICY admin_all_users ON users FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_companies ON companies FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_contacts ON contacts FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_products ON products FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_machine_groups ON machine_groups FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_machines ON machines FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_workflow_steps ON workflow_steps FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_product_workflow ON product_workflow FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_orders ON orders FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_order_items ON order_items FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_progress ON order_item_progress FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_files ON order_files FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_complaints ON complaints FOR ALL USING (public.current_user_role() = 'admin');
CREATE POLICY admin_all_webhooks ON webhook_events FOR ALL USING (public.current_user_role() = 'admin');

-- OPERATOR: odczyt zamowien + edycja statusow/progress
CREATE POLICY operator_read_orders ON orders FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_update_orders ON orders FOR UPDATE USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_items ON order_items FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_all_progress ON order_item_progress FOR ALL USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_products ON products FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_machine_groups ON machine_groups FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_machines ON machines FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_steps ON workflow_steps FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_pw ON product_workflow FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_files ON order_files FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_read_complaints ON complaints FOR SELECT USING (public.current_user_role() = 'operator');
CREATE POLICY operator_create_complaints ON complaints FOR INSERT WITH CHECK (public.current_user_role() = 'operator');

-- Operator widzi swoj profil
CREATE POLICY operator_own_profile ON users FOR SELECT USING (id = auth.uid());

-- CLIENT: widzi TYLKO swoje zamowienia
CREATE POLICY client_own_orders ON orders FOR SELECT USING (
  public.current_user_role() = 'client'
  AND contact_id IN (SELECT id FROM contacts WHERE user_id = auth.uid())
);
CREATE POLICY client_own_items ON order_items FOR SELECT USING (
  public.current_user_role() = 'client'
  AND order_id IN (
    SELECT id FROM orders WHERE contact_id IN (
      SELECT id FROM contacts WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY client_own_files ON order_files FOR SELECT USING (
  public.current_user_role() = 'client'
  AND order_id IN (
    SELECT id FROM orders WHERE contact_id IN (
      SELECT id FROM contacts WHERE user_id = auth.uid()
    )
  )
);
-- Client moze uploadowac pliki do swoich zamowien
CREATE POLICY client_upload_files ON order_files FOR INSERT WITH CHECK (
  public.current_user_role() = 'client'
  AND order_id IN (
    SELECT id FROM orders WHERE contact_id IN (
      SELECT id FROM contacts WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY client_own_profile ON users FOR SELECT USING (id = auth.uid());

-- ============================================================
-- 12. INDEKSY
-- ============================================================
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_deadline ON orders(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_progress_item ON order_item_progress(order_item_id);
CREATE INDEX idx_progress_status ON order_item_progress(status);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_allegro ON contacts(allegro_login) WHERE allegro_login IS NOT NULL;
CREATE INDEX idx_machines_group ON machines(group_id);
CREATE INDEX idx_product_workflow_product ON product_workflow(product_id);
CREATE INDEX idx_webhook_processed ON webhook_events(processed) WHERE NOT processed;
