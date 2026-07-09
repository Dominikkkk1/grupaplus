-- ============================================================
-- RLS: Klient moze czytac swoje kontakty i firmy
-- (potrzebne do JOIN-ow w orders query)
-- ============================================================

-- Klient czyta swoj kontakt
CREATE POLICY IF NOT EXISTS client_own_contacts ON contacts FOR SELECT
  USING (
    current_user_role() = 'client' AND user_id = auth.uid()
  );

-- Klient czyta firmy powiazane z jego zamowieniami
CREATE POLICY IF NOT EXISTS client_read_companies ON companies FOR SELECT
  USING (
    current_user_role() = 'client' AND EXISTS (
      SELECT 1 FROM orders o
      JOIN contacts c ON c.id = o.contact_id
      WHERE o.company_id = companies.id AND c.user_id = auth.uid()
    )
  );
