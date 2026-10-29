-- Probni podaci za razvoj (fiksni ID-evi, bezbedno za ponovno pokretanje).
-- Svaki salon na sopstvenom domenu (posle `npm run hosts:dev`):
--   Demo Salon  -> http://localhost.rs:3000
--   Salon dva   -> http://sajt2.rs:3000
--   Salon tri   -> http://sajt3.rs:3000
-- Poddomen i dalje radi: http://demo.localhost:3000
-- Admin platforme: http://localhost:3000/admin
-- Nalozi i lozinke: docs/dev-nalozi.md (`npm run db:seed` pravi korisnike i galeriju)
--
-- Primer poziva (ponedeljak 2026-10-12, "Fade sisanje", bilo koji radnik):
--   /api/availability?locationId=1&serviceId=1&date=2026-10-12

BEGIN;

INSERT INTO organizations (id, name, slug, status)
VALUES (1, 'Demo Salon', 'demo', 'published')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, organization_id, name, address, city, phone, slot_step_min)
VALUES (1, 1, 'Zemun centar', 'Glavna 1', 'Zemun', '+381 11 000 000', 15)
ON CONFLICT DO NOTHING;

INSERT INTO location_hours (location_id, weekday, opens_at, closes_at)
SELECT 1, d, '08:00', '22:00' FROM generate_series(0, 5) AS d
ON CONFLICT DO NOTHING;

INSERT INTO services (id, organization_id, name, description) VALUES
  (1, 1, 'Fade šišanje', 'Fade sa mašinicom i makazama'),
  (2, 1, 'Klasično šišanje', 'Klasično šišanje makazama')
ON CONFLICT DO NOTHING;

INSERT INTO location_services (location_id, service_id, price, duration_min, buffer_min) VALUES
  (1, 1, 1800, 60, 0),
  (1, 2, 1200, 30, 0)
ON CONFLICT DO NOTHING;

INSERT INTO staff (id, organization_id, display_name, title, bio) VALUES
  (1, 1, 'Marko', 'Barber', 'Fade i klasično šišanje.'),
  (2, 1, 'Jovana', 'Frizerka', 'Šišanje i fade (fade 75 min).')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  bio = COALESCE(staff.bio, EXCLUDED.bio);

INSERT INTO staff_locations (staff_id, location_id) VALUES
  (1, 1),
  (2, 1)
ON CONFLICT DO NOTHING;

-- Jovani fade traje 75 min (primer trajanja po zaposlenom)
INSERT INTO staff_services (staff_id, service_id, duration_override_min) VALUES
  (1, 1, NULL),
  (1, 2, NULL),
  (2, 1, 75),
  (2, 2, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES
  (1, 1, 'Prva smena', '08:00', '15:00'),
  (2, 1, 'Druga smena', '15:00', '22:00'),
  (3, 1, 'Cela smena', '09:00', '17:00')
ON CONFLICT DO NOTHING;

-- Marko: pon-pet prva smena, subota cela. Jovana: pon-pet druga smena.
INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT 1, 1, d, 1
FROM generate_series(0, 4) AS d
ON CONFLICT DO NOTHING;

INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id) VALUES
  (1, 1, 5, 3)
ON CONFLICT DO NOTHING;

INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT 2, 1, d, 2
FROM generate_series(0, 4) AS d
ON CONFLICT DO NOTHING;

INSERT INTO site_content (organization_id, page, key, language, value, status) VALUES
  (1, 'home', 'hero_title', 'sr-Latn', '"Frizer Zemun"', 'published'),
  (1, 'home', 'hero_subtitle', 'sr-Latn', '"Šišanje, fade i nega brade u Zemunu."', 'published'),
  (1, 'home', 'intro', 'sr-Latn', '"Zakažite termin online. Isti nalog važi za sve naše objekte. Radimo ponedeljak–subota."', 'published'),
  (1, 'about', 'title', 'sr-Latn', '"O nama"', 'published'),
  (1, 'about', 'body', 'sr-Latn', '"Porodični frizerski salon u centru Zemuna. Radimo klasično šišanje, fade i negu brade. Tim: Marko i Jovana."', 'published'),
  (1, 'contact', 'note', 'sr-Latn', '"Parking ispred objekta. Pozovite ili zakažite online."', 'published')
ON CONFLICT (organization_id, page, key, language, status) DO UPDATE SET value = EXCLUDED.value;

-- Dva dodatna salona, svaki na svom domenu (sajt2.rs / sajt3.rs)
INSERT INTO organizations (id, name, slug, status) VALUES
  (2, 'Salon dva', 'sajt2', 'published'),
  (3, 'Salon tri', 'sajt3', 'published')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, organization_id, name, address, city, phone, slot_step_min) VALUES
  (2, 2, 'Novi Sad', 'Dunavska 2', 'Novi Sad', '+381 21 000 000', 15),
  (3, 3, 'Niš', 'Obrenovićeva 3', 'Niš', '+381 18 000 000', 15)
ON CONFLICT DO NOTHING;

INSERT INTO location_hours (location_id, weekday, opens_at, closes_at)
SELECT loc, d, '09:00', '17:00'
FROM (VALUES (2), (3)) AS l(loc)
CROSS JOIN generate_series(0, 4) AS d
ON CONFLICT DO NOTHING;

INSERT INTO services (id, organization_id, name, description) VALUES
  (3, 2, 'Šišanje', 'Klasično šišanje'),
  (4, 2, 'Brada', 'Korekcija i oblikovanje brade'),
  (5, 3, 'Manikir', 'Klasičan manikir'),
  (6, 3, 'Pedikir', 'Klasičan pedikir')
ON CONFLICT DO NOTHING;

INSERT INTO location_services (location_id, service_id, price, duration_min, buffer_min) VALUES
  (2, 3, 1500, 45, 0),
  (2, 4, 800, 20, 0),
  (3, 5, 2000, 60, 0),
  (3, 6, 2500, 60, 0)
ON CONFLICT DO NOTHING;

INSERT INTO staff (id, organization_id, display_name, title, bio) VALUES
  (3, 2, 'Ana', 'Frizerka', 'Šišanje i brada u Novom Sadu.'),
  (4, 3, 'Ivana', 'Manikir', 'Manikir i pedikir u Nišu.')
ON CONFLICT DO NOTHING;

INSERT INTO staff_locations (staff_id, location_id) VALUES
  (3, 2),
  (4, 3)
ON CONFLICT DO NOTHING;

INSERT INTO staff_services (staff_id, service_id, duration_override_min) VALUES
  (3, 3, NULL),
  (3, 4, NULL),
  (4, 5, NULL),
  (4, 6, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES
  (4, 2, 'Dan', '09:00', '17:00'),
  (5, 3, 'Dan', '09:00', '17:00')
ON CONFLICT DO NOTHING;

INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT 3, 2, d, 4
FROM generate_series(0, 4) AS d
ON CONFLICT DO NOTHING;

INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
SELECT 4, 3, d, 5
FROM generate_series(0, 4) AS d
ON CONFLICT DO NOTHING;

UPDATE organizations SET theme = '{"primaryColor":"#0f766e"}'::jsonb WHERE id = 2;
UPDATE organizations SET theme = '{"primaryColor":"#7c3aed"}'::jsonb WHERE id = 3;

INSERT INTO site_content (organization_id, page, key, language, value, status) VALUES
  (2, 'home', 'hero_title', 'sr-Latn', '"Salon dva — Novi Sad"', 'published'),
  (2, 'home', 'hero_subtitle', 'sr-Latn', '"Šišanje i brada u Dunavskoj."', 'published'),
  (2, 'home', 'intro', 'sr-Latn', '"Zakažite online. Radimo ponedeljak–petak, 9–17h."', 'published'),
  (2, 'about', 'title', 'sr-Latn', '"O nama"', 'published'),
  (2, 'about', 'body', 'sr-Latn', '"Mali salon u centru Novog Sada. Ana radi šišanje i bradu."', 'published'),
  (2, 'contact', 'note', 'sr-Latn', '"Ulaz iz Dunavske. Zakažite online ili nas pozovite."', 'published'),
  (3, 'home', 'hero_title', 'sr-Latn', '"Salon tri — Niš"', 'published'),
  (3, 'home', 'hero_subtitle', 'sr-Latn', '"Manikir i pedikir u Obrenovićevoj."', 'published'),
  (3, 'home', 'intro', 'sr-Latn', '"Zakažite online. Radimo ponedeljak–petak, 9–17h."', 'published'),
  (3, 'about', 'title', 'sr-Latn', '"O nama"', 'published'),
  (3, 'about', 'body', 'sr-Latn', '"Salon za negu ruku i stopala u Nišu. Ivana radi manikir i pedikir."', 'published'),
  (3, 'contact', 'note', 'sr-Latn', '"Objekat je u pešačkoj zoni. Zakažite online."', 'published')
ON CONFLICT (organization_id, page, key, language, status) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO organization_domains (domain, organization_id, verified_at) VALUES
  ('localhost.rs', 1, now()),
  ('sajt2.rs', 2, now()),
  ('sajt3.rs', 3, now())
ON CONFLICT DO NOTHING;

-- Identity mora da krene posle eksplicitnih ID-eva, inace sledeci INSERT puca na 1, 2, 3.
SELECT setval(pg_get_serial_sequence('organizations', 'id'), (SELECT max(id) FROM organizations));
SELECT setval(pg_get_serial_sequence('locations', 'id'), (SELECT max(id) FROM locations));
SELECT setval(pg_get_serial_sequence('services', 'id'), (SELECT max(id) FROM services));
SELECT setval(pg_get_serial_sequence('staff', 'id'), (SELECT max(id) FROM staff));
SELECT setval(pg_get_serial_sequence('shift_templates', 'id'), (SELECT max(id) FROM shift_templates));
SELECT setval(pg_get_serial_sequence('site_content', 'id'), coalesce((SELECT max(id) FROM site_content), 1));

COMMIT;
