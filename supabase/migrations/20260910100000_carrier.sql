-- ============================================================
-- FUNKCJA 1: przewoznik na zamowieniu
--
-- `shipping_method` zostaje jako surowy tekst ze zrodla (np. nazwa metody
-- wysylki z WooCommerce). Do filtrowania sluzy nowa kolumna `carrier` —
-- slownik o zamknietej liscie wartosci, zeby "InPost", "inpost paczkomaty 24/7"
-- i "Paczkomat" nie byly trzema roznymi przewoznikami.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_carrier_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_carrier_check
      CHECK (carrier IS NULL OR carrier IN
        ('inpost', 'dpd', 'dhl', 'gls', 'poczta', 'ups', 'fedex', 'inny'));
  END IF;
END $$;

-- Indeks pod widok "Do wysylki" (przesylki gotowe do wydania, wg przewoznika)
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier)
  WHERE carrier IS NOT NULL;
