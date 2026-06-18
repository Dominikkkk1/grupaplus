-- Partial unique index na email (pozwala wiele NULL, ale niepusty musi byc unikalny)
CREATE UNIQUE INDEX idx_contacts_email_unique
  ON contacts(email) WHERE email IS NOT NULL;
