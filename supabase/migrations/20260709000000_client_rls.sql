-- ============================================================
-- RLS: Klient moze czytac swoje kontakty i firmy
-- (potrzebne do JOIN-ow w orders query)
--
-- UWAGA: Postgres NIE zna skladni `CREATE POLICY IF NOT EXISTS`
-- (to byl blad, przez ktory cala ta migracja sie nie wykonywala).
-- Wzorzec: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================

-- Klient czyta swoj kontakt
DROP POLICY IF EXISTS client_own_contacts ON contacts;
CREATE POLICY client_own_contacts ON contacts FOR SELECT
  USING (
    public.current_user_role() = 'client' AND user_id = auth.uid()
  );

-- Klient czyta firmy powiazane z jego zamowieniami
DROP POLICY IF EXISTS client_read_companies ON companies;
CREATE POLICY client_read_companies ON companies FOR SELECT
  USING (
    public.current_user_role() = 'client' AND EXISTS (
      SELECT 1 FROM orders o
      JOIN contacts c ON c.id = o.contact_id
      WHERE o.company_id = companies.id AND c.user_id = auth.uid()
    )
  );
