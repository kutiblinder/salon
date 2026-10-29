-- Probni podaci za razvoj (fiksni ID-evi, bezbedno za ponovno pokretanje).
-- Tri realna salona, svaki na sopstvenom domenu (posle `npm run hosts:dev`):
--   Atelje Kosić (frizer)     -> http://ateljekosic.rs:3000  (i atelje.localhost:3000)
--   Zen Masaža                 -> http://zenmasaza.rs:3000    (i zen.localhost:3000)
--   Bella Nails (manikir)      -> http://bellanails.rs:3000   (i bella.localhost:3000)
-- Admin platforme: http://localhost:3000/admin
-- Nalozi i lozinke: docs/dev-nalozi.md (`npm run db:seed` pravi korisnike i galeriju)
--
-- Bella Nails ima uključenu potvrdu gosta emailom (rok 1 sat); ostali saloni zakazuju odmah.

BEGIN;

-- Čist kalendar seed-a (lokalni demo, ne produkcija)
DELETE FROM appointments WHERE organization_id IN (1, 2, 3);
DELETE FROM location_services WHERE location_id IN (1, 2, 3, 4);
DELETE FROM staff_services WHERE staff_id IN (1, 2, 3, 4, 5, 6);
DELETE FROM location_hours WHERE location_id IN (1, 2, 3, 4);

INSERT INTO organizations (id, name, slug, status, theme, guest_confirm_email)
VALUES
  (1, 'Atelje Kosić', 'atelje', 'published', '{"primaryColor":"#7A2E2E","schemaType":"HairSalon"}'::jsonb, false),
  (2, 'Zen Masaža', 'zen', 'published', '{"primaryColor":"#3F6B5A","schemaType":"DaySpa"}'::jsonb, false),
  (3, 'Bella Nails', 'bella', 'published', '{"primaryColor":"#B76E79","schemaType":"NailSalon"}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  status = EXCLUDED.status,
  theme = EXCLUDED.theme,
  guest_confirm_email = EXCLUDED.guest_confirm_email;

INSERT INTO locations (id, organization_id, name, address, city, phone, slot_step_min, sort_order)
VALUES
  (1, 1, 'Zemun', 'Glavna 48', 'Zemun', '+381 11 316 2200', 15, 0),
  (4, 1, 'Novi Beograd', 'Jurija Gagarina 14', 'Novi Beograd', '+381 11 215 4410', 15, 1),
  (2, 2, 'Vračar', 'Njegoševa 22', 'Beograd', '+381 11 344 1180', 15, 0),
  (3, 3, 'Stari grad', 'Kralja Petra 16', 'Beograd', '+381 11 262 9050', 15, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  phone = EXCLUDED.phone,
  slot_step_min = EXCLUDED.slot_step_min,
  sort_order = EXCLUDED.sort_order;

INSERT INTO location_hours (location_id, weekday, opens_at, closes_at)
SELECT 1, d, '08:00', '20:00' FROM generate_series(0, 5) AS d;
INSERT INTO location_hours (location_id, weekday, opens_at, closes_at)
SELECT 4, d, '09:00', '18:00' FROM generate_series(0, 5) AS d;
INSERT INTO location_hours (location_id, weekday, opens_at, closes_at)
SELECT 2, d, '09:00', '21:00' FROM generate_series(0, 5) AS d;
INSERT INTO location_hours (location_id, weekday, opens_at, closes_at)
SELECT 3, d, '09:00', '19:00' FROM generate_series(0, 5) AS d;

INSERT INTO services (id, organization_id, name, description) VALUES
  (1, 1, 'Muško šišanje', 'Klasično muško šišanje makazama i mašinicom'),
  (2, 1, 'Fade', 'Skin fade ili mid fade, završnica makazama'),
  (7, 1, 'Žensko šišanje', 'Pranje, šišanje i feniranje'),
  (8, 1, 'Feniranje', 'Feniranje i oblikovanje'),
  (9, 1, 'Brada i brkovi', 'Korekcija i oblikovanje brade'),
  (10, 1, 'Šišanje i brada', 'Muško šišanje plus brada'),
  (3, 2, 'Relaks masaža 60 min', 'Klasična relaks masaža celog tela'),
  (4, 2, 'Sportska masaža 60 min', 'Dubinska masaža za napete mišiće'),
  (11, 2, 'Masaža leđa 30 min', 'Vrat, ramena i leđa'),
  (12, 2, 'Anticelulit masaža 45 min', 'Maderoterapija / anticelulit'),
  (13, 2, 'Aroma masaža 90 min', 'Relaks masaža sa etarskim uljima'),
  (5, 3, 'Manikir', 'Obrada noktiju, kutikule i lak'),
  (6, 3, 'Pedikir', 'Kompletna nega stopala'),
  (14, 3, 'Gel lak', 'Manikir sa trajnim lakom'),
  (15, 3, 'Nadogradnja noktiju', 'Gel nadogradnja i oblikovanje'),
  (16, 3, 'Pedikir sa gel lakom', 'Pedikir i trajni lak na nožnim noktima')
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO location_services (location_id, service_id, price, duration_min, buffer_min) VALUES
  (1, 1, 1800, 30, 0),
  (1, 2, 2200, 45, 0),
  (1, 7, 3200, 60, 0),
  (1, 8, 2000, 45, 0),
  (1, 9, 1200, 25, 0),
  (1, 10, 2800, 50, 0),
  (4, 1, 1900, 30, 0),
  (4, 2, 2400, 45, 0),
  (4, 7, 3400, 60, 0),
  (4, 8, 2100, 45, 0),
  (4, 9, 1300, 25, 0),
  (4, 10, 3000, 50, 0),
  (2, 3, 4500, 60, 10),
  (2, 4, 5200, 60, 10),
  (2, 11, 2800, 30, 10),
  (2, 12, 3800, 45, 10),
  (2, 13, 6800, 90, 10),
  (3, 5, 2200, 45, 5),
  (3, 6, 3200, 60, 5),
  (3, 14, 3400, 75, 5),
  (3, 15, 4800, 120, 5),
  (3, 16, 4200, 90, 5);

INSERT INTO staff (id, organization_id, display_name, title, bio, sort_order) VALUES
  (1, 1, 'Marko Kosić', 'Barber', 'Fade, klasično šišanje i brada. Radi u Zemunu.', 0),
  (2, 1, 'Jovana Kosić', 'Frizerka', 'Žensko i muško šišanje, feniranje. Zemun i Novi Beograd.', 1),
  (3, 2, 'Ana Simić', 'Maserka', 'Relaks i aroma masaže. Sertifikovana za klasičnu masažu.', 0),
  (5, 2, 'Nemanja Ilić', 'Maser', 'Sportska i anticelulit masaža. Radi sa sportistima.', 1),
  (4, 3, 'Ivana Petrović', 'Nokti', 'Gel lak, nadogradnja i manikir.', 0),
  (6, 3, 'Milica Jovanović', 'Nokti', 'Pedikir i trajni lak na nožnim noktima.', 1)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  title = EXCLUDED.title,
  bio = EXCLUDED.bio,
  sort_order = EXCLUDED.sort_order;

INSERT INTO staff_locations (staff_id, location_id) VALUES
  (1, 1),
  (2, 1),
  (2, 4),
  (3, 2),
  (5, 2),
  (4, 3),
  (6, 3)
ON CONFLICT DO NOTHING;

INSERT INTO staff_services (staff_id, service_id, duration_override_min) VALUES
  (1, 1, NULL), (1, 2, NULL), (1, 9, NULL), (1, 10, NULL),
  (2, 1, NULL), (2, 2, 55), (2, 7, NULL), (2, 8, NULL), (2, 9, NULL), (2, 10, NULL),
  (3, 3, NULL), (3, 11, NULL), (3, 13, NULL),
  (5, 3, NULL), (5, 4, NULL), (5, 11, NULL), (5, 12, NULL),
  (4, 5, NULL), (4, 14, NULL), (4, 15, NULL),
  (6, 5, NULL), (6, 6, NULL), (6, 16, NULL);

INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES
  (1, 1, 'Jutarnja', '08:00', '14:00'),
  (2, 1, 'Popodnevna', '14:00', '20:00'),
  (3, 1, 'Subota', '09:00', '16:00'),
  (6, 4, 'Dan', '09:00', '18:00'),
  (4, 2, 'Dan', '09:00', '21:00'),
  (5, 3, 'Dan', '09:00', '19:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

DELETE FROM weekly_schedule WHERE staff_id IN (1, 2, 3, 4, 5, 6);

-- Marko: pon-pet jutarnja u Zemunu, subota kraća
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT 1, 1, d, 1 FROM generate_series(0, 4) AS d;
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id) VALUES (1, 1, 5, 3);

-- Jovana: pon-čet popodne Zemun; pet-sub Novi Beograd
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT 2, 1, d, 2 FROM generate_series(0, 3) AS d;
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id) VALUES
  (2, 4, 4, 6),
  (2, 4, 5, 6);

-- Zen: Ana i Nemanja pon-sub
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT s, 2, d, 4 FROM unnest(ARRAY[3, 5]::bigint[]) s CROSS JOIN generate_series(0, 5) d;

-- Bella: Ivana i Milica pon-sub
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT s, 3, d, 5 FROM unnest(ARRAY[4, 6]::bigint[]) s CROSS JOIN generate_series(0, 5) d;

INSERT INTO site_content (organization_id, page, key, language, value, status) VALUES
  (1, 'home', 'hero_title', 'sr-Latn', '"Frizer Zemun — Atelje Kosić"', 'published'),
  (1, 'home', 'hero_subtitle', 'sr-Latn', '"Šišanje, fade i brada. Dva objekta: Zemun i Novi Beograd."', 'published'),
  (1, 'home', 'intro', 'sr-Latn', '"Porodični barber atelje. Zakažite online, isti nalog važi u oba objekta. Radimo ponedeljak–subota."', 'published'),
  (1, 'about', 'title', 'sr-Latn', '"O nama"', 'published'),
  (1, 'about', 'body', 'sr-Latn', '"Atelje Kosić radi od 2014. u Zemunu. Marko je barber (fade i brada), Jovana radi žensko i muško šišanje i feniranje. Drugi objekat je na Novom Beogradu, u Jurija Gagarina. Cene su usklađene sa centrom Beograda: muško šišanje 1.800 din, fade 2.200, žensko šišanje 3.200."', 'published'),
  (1, 'contact', 'note', 'sr-Latn', '"Zemun: Glavna 48, parking iza zgrade. Novi Beograd: Jurija Gagarina 14, tramvaj 7 i 9. Zakažite online ili nas pozovite."', 'published'),
  (2, 'home', 'hero_title', 'sr-Latn', '"Zen Masaža — Vračar"', 'published'),
  (2, 'home', 'hero_subtitle', 'sr-Latn', '"Relaks, sportska i aroma masaža u Njegoševoj."', 'published'),
  (2, 'home', 'intro', 'sr-Latn', '"Mala ordinacija za masažu na Vračaru. Zakažite 60 ili 90 minuta. Radimo ponedeljak–subota, 9–21h."', 'published'),
  (2, 'about', 'title', 'sr-Latn', '"O nama"', 'published'),
  (2, 'about', 'body', 'sr-Latn', '"Zen Masaža je studio sa dve kabine u Njegoševoj na Vračaru. Ana radi relaks i aroma masaže, Nemanja sportsku i anticelulit. Ulje, peškir i čaj su uključeni u cenu. Relaks 60 min je 4.500 din, sportska 5.200, aroma 90 min 6.800."', 'published'),
  (2, 'contact', 'note', 'sr-Latn', '"Ulaz iz Njegoševe, drugo dvorište. Interfon Zen. Dođite 5 min ranije; posle masaže imate 10 min da se spremite."', 'published'),
  (3, 'home', 'hero_title', 'sr-Latn', '"Bella Nails — Stari grad"', 'published'),
  (3, 'home', 'hero_subtitle', 'sr-Latn', '"Manikir, gel lak, nadogradnja i pedikir u Kralja Petra."', 'published'),
  (3, 'home', 'intro', 'sr-Latn', '"Zakažite online. Gost potvrđuje termin linkom sa emaila u roku od sat vremena. Radimo ponedeljak–subota, 9–19h."', 'published'),
  (3, 'about', 'title', 'sr-Latn', '"O nama"', 'published'),
  (3, 'about', 'body', 'sr-Latn', '"Bella Nails je studio za negu ruku i stopala u Kralja Petra, Stari grad. Ivana radi gel lak i nadogradnju, Milica pedikir. Manikir 2.200 din, gel lak 3.400, pedikir 3.200, nadogradnja 4.800. Koristimo sterilizovan pribor i brendirane gelove."', 'published'),
  (3, 'contact', 'note', 'sr-Latn', '"Kralja Petra 16, prizemlje. Pešačka zona, parking u Vasinoj. Termin važi kad ga potvrdite sa emaila."', 'published')
ON CONFLICT (organization_id, page, key, language, status) DO UPDATE SET value = EXCLUDED.value;

DELETE FROM organization_domains WHERE organization_id IN (1, 2, 3);
INSERT INTO organization_domains (domain, organization_id, verified_at) VALUES
  ('ateljekosic.rs', 1, now()),
  ('zenmasaza.rs', 2, now()),
  ('bellanails.rs', 3, now());

UPDATE users SET email = replace(email, '@localhost.rs', '@ateljekosic.rs')
 WHERE organization_id = 1 AND email LIKE '%@localhost.rs';
UPDATE users SET email = replace(email, '@sajt2.rs', '@zenmasaza.rs')
 WHERE organization_id = 2 AND email LIKE '%@sajt2.rs';
UPDATE users SET email = replace(email, '@sajt3.rs', '@bellanails.rs')
 WHERE organization_id = 3 AND email LIKE '%@sajt3.rs';

WITH cal AS (
  SELECT (timezone('Europe/Belgrade', now()))::date AS today
),
days AS (
  SELECT
    today + ((1 - EXTRACT(ISODOW FROM today)::int + 7) % 7) AS mon,
    today + ((2 - EXTRACT(ISODOW FROM today)::int + 7) % 7) AS tue,
    today + ((3 - EXTRACT(ISODOW FROM today)::int + 7) % 7) AS wed,
    today + ((4 - EXTRACT(ISODOW FROM today)::int + 7) % 7) AS thu,
    today + ((5 - EXTRACT(ISODOW FROM today)::int + 7) % 7) AS fri
  FROM cal
),
slots AS (
  SELECT * FROM (VALUES
    (1::bigint, 1::bigint, 1::bigint, 2::bigint, 'Fade', 2200::numeric, 45, 'Nikola Kovač', '+381640101001', '09:00'::time, (SELECT mon FROM days)),
    (1, 1, 1, 1, 'Muško šišanje', 1800, 30, 'Jelena Stanković', '+381640101002', '11:00', (SELECT wed FROM days)),
    (1, 1, 2, 7, 'Žensko šišanje', 3200, 60, 'Marija Đorđević', '+381640101004', '15:00', (SELECT tue FROM days)),
    (1, 4, 2, 8, 'Feniranje', 2100, 45, 'Ivana Belić', '+381640101005', '10:00', (SELECT fri FROM days)),
    (2, 2, 3, 3, 'Relaks masaža 60 min', 4500, 60, 'Sara Minić', '+381640202002', '10:00', (SELECT tue FROM days)),
    (2, 2, 3, 13, 'Aroma masaža 90 min', 6800, 90, 'Petar Vučić', '+381640202003', '14:00', (SELECT wed FROM days)),
    (2, 2, 5, 4, 'Sportska masaža 60 min', 5200, 60, 'Una Savić', '+381640202004', '11:00', (SELECT tue FROM days)),
    (2, 2, 5, 11, 'Masaža leđa 30 min', 2800, 30, 'Đorđe Minić', '+381640202005', '09:30', (SELECT thu FROM days)),
    (3, 3, 4, 14, 'Gel lak', 3400, 75, 'Elena Ristić', '+381640303001', '10:00', (SELECT mon FROM days)),
    (3, 3, 4, 15, 'Nadogradnja noktiju', 4800, 120, 'Tara Nikolić', '+381640303003', '12:00', (SELECT wed FROM days)),
    (3, 3, 6, 6, 'Pedikir', 3200, 60, 'Marko Janković', '+381640303002', '11:00', (SELECT tue FROM days)),
    (3, 3, 6, 16, 'Pedikir sa gel lakom', 4200, 90, 'Vuk Pavlović', '+381640303004', '13:00', (SELECT thu FROM days))
  ) AS v(org_id, loc_id, staff_id, service_id, service_name, price, duration_min, guest_name, guest_phone, hm, day)
)
INSERT INTO appointments (
  organization_id, location_id, staff_id, service_id, guest_name, guest_phone,
  starts_at, ends_at, service_name_snapshot, price_snapshot, duration_snapshot_min, status, confirmed_at
)
SELECT
  s.org_id, s.loc_id, s.staff_id, s.service_id, s.guest_name, s.guest_phone,
  (s.day + s.hm) AT TIME ZONE 'Europe/Belgrade',
  (s.day + s.hm) AT TIME ZONE 'Europe/Belgrade' + make_interval(mins => s.duration_min),
  s.service_name, s.price, s.duration_min, 'confirmed', now()
FROM slots s;

SELECT setval(pg_get_serial_sequence('organizations', 'id'), (SELECT max(id) FROM organizations));
SELECT setval(pg_get_serial_sequence('locations', 'id'), (SELECT max(id) FROM locations));
SELECT setval(pg_get_serial_sequence('services', 'id'), (SELECT max(id) FROM services));
SELECT setval(pg_get_serial_sequence('staff', 'id'), (SELECT max(id) FROM staff));
SELECT setval(pg_get_serial_sequence('shift_templates', 'id'), (SELECT max(id) FROM shift_templates));
SELECT setval(pg_get_serial_sequence('site_content', 'id'), coalesce((SELECT max(id) FROM site_content), 1));
SELECT setval(pg_get_serial_sequence('appointments', 'id'), coalesce((SELECT max(id) FROM appointments), 1));

COMMIT;
