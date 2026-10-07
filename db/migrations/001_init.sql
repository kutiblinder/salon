-- =====================================================================
-- Platforma za zakazivanje termina u salonima: PostgreSQL 14+ šema
-- Tenant = organizacija (organizations). Svaka tabela sa podacima salona
-- nosi organization_id, da bi tenant filter i Row Level Security bili laki.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- exclusion constraint nad (staff_id, vreme)
CREATE EXTENSION IF NOT EXISTS citext;      -- email bez razlike velikih/malih slova

-- ---------------------------------------------------------------------
-- Tipovi
-- ---------------------------------------------------------------------
CREATE TYPE role_name        AS ENUM ('admin', 'owner', 'manager', 'staff');
CREATE TYPE membership_scope AS ENUM ('platform', 'organization', 'location');
CREATE TYPE publish_status   AS ENUM ('draft', 'published');
CREATE TYPE appointment_status AS ENUM
  ('pending',      -- gost još nije potvrdio (SMS kod / email link)
   'confirmed',
   'cancelled_by_client',
   'cancelled_by_salon',
   'completed',
   'no_show');
CREATE TYPE time_off_kind AS ENUM ('break', 'vacation', 'sick', 'other');

-- ---------------------------------------------------------------------
-- Korisnici (jedan nalog, više članstava)
-- Klijenti su obični nalozi bez članstva.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE,
  phone         text,
  full_name     text NOT NULL,
  password_hash text,                       -- NULL ako koristiš eksterni auth provajder
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX users_phone_idx ON users (phone);   -- vezivanje gost-termina za nalog

-- ---------------------------------------------------------------------
-- Organizacije (tenant), domeni, lokacije
-- ---------------------------------------------------------------------
CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE
             CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),  -- subdomen: slug.tvojsajt.rs
  status     publish_status NOT NULL DEFAULT 'draft',           -- sajt javan tek kad je 'published'
  theme      jsonb NOT NULL DEFAULT '{}'::jsonb,                -- logo, primarna boja, favicon
  default_language text NOT NULL DEFAULT 'sr-Latn',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Custom domeni (kasnije); jedan red po domenu
CREATE TABLE organization_domains (
  domain          text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text,
  city            text,
  phone           text,
  email           citext,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  timezone        text NOT NULL DEFAULT 'Europe/Belgrade',
  slot_step_min   int  NOT NULL DEFAULT 15 CHECK (slot_step_min > 0),  -- korak početaka termina
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  UNIQUE (id, organization_id)           -- omogućava složene FK koji čuvaju tenant
);

-- Radno vreme lokacije (za prikaz na sajtu); 0 = ponedeljak ... 6 = nedelja
CREATE TABLE location_hours (
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at    time NOT NULL,
  closes_at   time NOT NULL,
  PRIMARY KEY (location_id, weekday),
  CHECK (closes_at > opens_at)
);

-- ---------------------------------------------------------------------
-- Članstva, uloge, dozvole
-- ---------------------------------------------------------------------
CREATE TABLE memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            role_name NOT NULL,
  scope           membership_scope NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES locations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'platform'     AND organization_id IS NULL     AND location_id IS NULL) OR
    (scope = 'organization' AND organization_id IS NOT NULL AND location_id IS NULL) OR
    (scope = 'location'     AND organization_id IS NOT NULL AND location_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX memberships_unique_idx ON memberships
  (user_id, role, scope, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'),
   COALESCE(location_id, '00000000-0000-0000-0000-000000000000'));

-- Podrazumevane dozvole po ulozi (seed ispod)
CREATE TABLE role_permissions (
  role       role_name NOT NULL,
  permission text NOT NULL,
  own_only   boolean NOT NULL DEFAULT false,   -- "samo svoje" (npr. zaposleni vidi samo svoje termine)
  PRIMARY KEY (role, permission)
);

-- Izuzeci po salonu (admin ih menja prekidačima)
CREATE TABLE organization_permission_overrides (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            role_name NOT NULL,
  permission      text NOT NULL,
  granted         boolean NOT NULL,
  PRIMARY KEY (organization_id, role, permission)
);

INSERT INTO role_permissions (role, permission, own_only) VALUES
  ('admin','content.edit',false), ('admin','gallery.edit',false),
  ('admin','prices.edit',false),  ('admin','services.edit',false),
  ('admin','locations.manage',false), ('admin','staff.manage',false),
  ('admin','schedule.manage',false),  ('admin','appointments.manage',false),
  ('admin','clients.view',false),
  ('owner','locations.manage',false), ('owner','staff.manage',false),
  ('owner','schedule.manage',false),  ('owner','appointments.manage',false),
  ('owner','clients.view',false),
  ('manager','schedule.manage',false), ('manager','appointments.manage',false),
  ('manager','clients.view',false),
  ('staff','schedule.manage',true), ('staff','appointments.manage',true),
  ('staff','clients.view',true);

-- ---------------------------------------------------------------------
-- Zaposleni (profil koji se prikazuje na sajtu; nalog je opcion)
-- ---------------------------------------------------------------------
CREATE TABLE staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,  -- NULL = nema login
  display_name    text NOT NULL,
  title           text,                 -- npr. "Barber", "Masažer"
  bio             text,
  photo_url       text,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  UNIQUE (id, organization_id)
);

-- Na kojim lokacijama radi
CREATE TABLE staff_locations (
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, location_id)
);

-- ---------------------------------------------------------------------
-- Usluge: katalog na nivou organizacije, cena i trajanje po lokaciji
-- ---------------------------------------------------------------------
CREATE TABLE service_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE TABLE services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  name            text NOT NULL,        -- "Fade šišanje"
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  UNIQUE (id, organization_id)
);

CREATE TABLE location_services (
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  service_id    uuid NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  price         numeric(10,2) NOT NULL CHECK (price >= 0),
  currency      char(3) NOT NULL DEFAULT 'RSD',
  duration_min  int NOT NULL CHECK (duration_min > 0),
  buffer_min    int NOT NULL DEFAULT 0 CHECK (buffer_min >= 0),  -- priprema/čišćenje posle usluge
  is_active     boolean NOT NULL DEFAULT true,
  PRIMARY KEY (location_id, service_id)
);

-- Ko radi koju uslugu. Opciono trajanje po zaposlenom (junior radi sporije).
CREATE TABLE staff_services (
  staff_id             uuid NOT NULL REFERENCES staff(id)    ON DELETE CASCADE,
  service_id           uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  duration_override_min int CHECK (duration_override_min IS NULL OR duration_override_min > 0),
  PRIMARY KEY (staff_id, service_id)
);

-- ---------------------------------------------------------------------
-- Smene i raspored
-- ---------------------------------------------------------------------
-- Šablon smene (definiše vlasnik): "Prva 08:00-15:00", "Druga 15:00-22:00"
CREATE TABLE shift_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  starts_at   time NOT NULL,
  ends_at     time NOT NULL,
  CHECK (ends_at > starts_at)       -- smene preko ponoći nisu podržane u MVP-u
);

-- Nedeljni obrazac koji se ponavlja (0 = ponedeljak)
CREATE TABLE weekly_schedule (
  staff_id          uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  location_id       uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  weekday           smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  shift_template_id uuid NOT NULL REFERENCES shift_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, weekday)   -- jedna smena dnevno po zaposlenom (pojednostavljenje)
);

-- Izuzeci za konkretan datum; shift_template_id NULL = slobodan dan
CREATE TABLE schedule_exceptions (
  staff_id          uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date         date NOT NULL,
  location_id       uuid REFERENCES locations(id) ON DELETE CASCADE,
  shift_template_id uuid REFERENCES shift_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, work_date)
);

-- Pauze i odsustva (oduzimaju se od smene)
CREATE TABLE time_off (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id  uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  during    tstzrange NOT NULL,
  kind      time_off_kind NOT NULL DEFAULT 'other',
  note      text,
  CHECK (NOT isempty(during))
);
CREATE INDEX time_off_staff_idx ON time_off USING gist (staff_id, during);

-- ---------------------------------------------------------------------
-- Termini
-- ---------------------------------------------------------------------
CREATE TABLE appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES locations(id),
  staff_id        uuid NOT NULL REFERENCES staff(id),
  service_id      uuid NOT NULL REFERENCES services(id),

  -- Klijent: registrovan ILI gost
  client_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  guest_name      text,
  guest_phone     text,
  guest_email     citext,

  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,   -- uključuje buffer ako ga koristiš
  during          tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at)) STORED,

  -- Snapshot: kasnija promena cene/naziva ne menja stare termine
  service_name_snapshot text NOT NULL,
  price_snapshot        numeric(10,2) NOT NULL,
  duration_snapshot_min int NOT NULL,

  status          appointment_status NOT NULL DEFAULT 'pending',
  pending_expires_at timestamptz,         -- istek nepotvrđenog gost-termina
  confirmed_at    timestamptz,
  cancelled_at    timestamptz,
  client_note     text,
  internal_note   text,                   -- vide samo vlasnik/zaposleni (alergije, boja)
  manage_token_hash text,                 -- hash tokena iz linka za otkaz/promenu (bez logovanja)
  created_by_user_id uuid REFERENCES users(id),  -- NULL = klijent sam; inače zaposleni/vlasnik
  created_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (ends_at > starts_at),
  CHECK (client_user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_phone IS NOT NULL)),

  -- Isti zaposleni ne može imati dva aktivna termina koja se preklapaju.
  -- Baza ovo garantuje i kad dva klijenta kliknu u istoj milisekundi.
  CONSTRAINT no_double_booking
    EXCLUDE USING gist (staff_id WITH =, during WITH &&)
    WHERE (status IN ('pending', 'confirmed')),

  -- Tenant-čuvajući strani ključevi: lokacija/zaposleni/usluga moraju biti iz iste organizacije
  FOREIGN KEY (location_id, organization_id) REFERENCES locations(id, organization_id),
  FOREIGN KEY (staff_id,    organization_id) REFERENCES staff(id, organization_id),
  FOREIGN KEY (service_id,  organization_id) REFERENCES services(id, organization_id)
);
CREATE INDEX appointments_org_time_idx    ON appointments (organization_id, starts_at);
CREATE INDEX appointments_location_idx    ON appointments (location_id, starts_at);
CREATE INDEX appointments_client_idx      ON appointments (client_user_id, starts_at DESC);
CREATE INDEX appointments_guest_phone_idx ON appointments (guest_phone) WHERE client_user_id IS NULL;
CREATE INDEX appointments_pending_idx     ON appointments (pending_expires_at) WHERE status = 'pending';

-- Za MVP: jedna usluga po terminu. Kasnije dodati appointment_services (termin + usluga + redosled).

-- ---------------------------------------------------------------------
-- Sadržaj sajta (ključ-vrednost, dozvoljene ključeve definiši u kodu)
-- ---------------------------------------------------------------------
CREATE TABLE site_content (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page            text NOT NULL,                 -- 'home', 'about', 'contact'
  key             text NOT NULL,                 -- 'title', 'subtitle', 'body', 'hero_image'
  language        text NOT NULL DEFAULT 'sr-Latn',
  value           jsonb NOT NULL,
  status          publish_status NOT NULL DEFAULT 'published',
  version         int NOT NULL DEFAULT 1,
  updated_by      uuid REFERENCES users(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, page, key, language, status)
);

-- Istorija verzija teksta (vraćanje prethodne verzije)
CREATE TABLE site_content_history (
  id              bigserial PRIMARY KEY,
  site_content_id uuid NOT NULL REFERENCES site_content(id) ON DELETE CASCADE,
  value           jsonb NOT NULL,
  version         int NOT NULL,
  changed_by      uuid REFERENCES users(id),
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  storage_key     text NOT NULL,                 -- ključ u object storage-u (S3/R2)
  mime_type       text NOT NULL,
  width           int,
  height          int,
  size_bytes      bigint,
  uploaded_by     uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gallery_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES locations(id) ON DELETE SET NULL,
  media_id        uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  alt_text        text,                          -- SEO + pristupačnost
  caption         text,
  sort_order      int NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- Audit log (piše se u istoj transakciji kao promena)
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  action          text NOT NULL,                 -- 'prices.edit', 'content.edit', ...
  object_type     text NOT NULL,                 -- 'location_service', 'site_content', ...
  object_id       text,
  old_value       jsonb,
  new_value       jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_time_idx ON audit_log (organization_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Row Level Security: druga linija odbrane (primer za appointments)
-- Aplikacija na početku zahteva: SET LOCAL app.organization_id = '<uuid>';
-- Aplikacija se mora povezivati ulogom koja NIJE vlasnik tabela (ili FORCE RLS).
-- Za admin "ulazak u salon" postavlja se organization_id izabranog salona.
-- ---------------------------------------------------------------------
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON appointments
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
-- Isti obrazac primeniti na: locations, staff, services, site_content, media,
-- gallery_items, shift_templates (preko location_id), ...
