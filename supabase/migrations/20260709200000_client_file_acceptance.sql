-- Pliki klienta: oznaczenie + akceptacja
ALTER TABLE order_files ADD COLUMN IF NOT EXISTS is_client_upload boolean NOT NULL DEFAULT false;
ALTER TABLE order_files ADD COLUMN IF NOT EXISTS is_accepted boolean NOT NULL DEFAULT true;
