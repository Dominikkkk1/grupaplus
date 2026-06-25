-- Wymiary docelowe produktu (do porownania z plikiem w preflight)
ALTER TABLE products ADD COLUMN width_mm numeric(8,1);
ALTER TABLE products ADD COLUMN height_mm numeric(8,1);
