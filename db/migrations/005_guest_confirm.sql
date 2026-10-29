-- Gost-termin: salon bira da li mora potvrda email linkom (rok 1 sat).
ALTER TABLE organizations
  ADD COLUMN guest_confirm_email boolean NOT NULL DEFAULT false;
