-- Zakazivanje gosta: pretraga termina po tokenu iz linka i evidencija saglasnosti.

-- Link za potvrdu/otkazivanje nosi token; u bazi je samo njegov SHA-256 hash.
CREATE UNIQUE INDEX appointments_manage_token_idx
  ON appointments (manage_token_hash) WHERE manage_token_hash IS NOT NULL;

-- Kada je klijent prihvatio politiku privatnosti pri zakazivanju (Zakon o zaštiti podataka o ličnosti).
ALTER TABLE appointments ADD COLUMN privacy_consent_at timestamptz;
