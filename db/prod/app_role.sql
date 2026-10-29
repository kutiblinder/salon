-- Produkcijska uloga aplikacije (nije vlasnik tabela, pa RLS na appointments vazi).
-- Pokreni kao vlasnik baze POSLE migracija. Lozinku zameni; ne commit-uj pravu lozinku.
--
--   psql "$DATABASE_URL" -f db/prod/app_role.sql
--
-- Zatim DATABASE_URL *aplikacije* (ne migracija): postgres://salon_app:<lozinka>@db:5432/salon
-- Migracije i seed ostaju na vlasniku (salon).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salon_app') THEN
    CREATE ROLE salon_app LOGIN PASSWORD 'promeni_me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE salon TO salon_app;
GRANT USAGE ON SCHEMA public TO salon_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO salon_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO salon_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO salon_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO salon_app;
