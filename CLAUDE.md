# CLAUDE.md: Salon platforma

Ovaj fajl sadrzi sve odluke donete tokom planiranja. Pre pisanja koda procitaj ga do kraja.
Vlasnik projekta komunicira na srpskom (latinica): odgovaraj na srpskom, a kod, imena
promenljivih, tabela i commit poruke pisi na engleskom.

## Sta gradimo

Web platforma za zakazivanje termina u frizerskim salonima, salonima za masazu, manikir i pedikir.
Svaki salon dobija svoj sajt (vitrinu) sa zakazivanjem. Isti izgled za sve salone, razlikuju se
logo, boje, sadrzaj, usluge i cene. Gradi se sam vlasnik projekta, za pocetak nekoliko salona.

## Tehnologija (odluceno)

- **Next.js (App Router) + TypeScript**, jedan projekat u `app/` (frontend i backend zajedno).
  Javne stranice se renderuju na serveru (SEO: "frizer Zemun", schema.org `HairSalon`).
- **PostgreSQL 16** u Dockeru (`docker-compose.yml`). Isto lokalno i na Hetzner VPS-u.
- **Mobilni prikaz je prioritet** (vecina klijenata zakazuje sa telefona). Tailwind CSS.
- Autentifikacija: **Better Auth** (odluka vlasnika; Auth.js je od 2025. deo Better Auth-a i samo
  se odrzava), email + lozinka. Detalji u `docs/autentifikacija.md`. Better Auth koristi Kysely
  samo interno (omotac za izolaciju po salonu); aplikacija i dalje pise upite kroz `pg`.
- **Migracije**: izvor istine je SQL u `db/migrations/` (`001_init.sql`). Sema koristi exclusion
  constraint i Row Level Security, koje ORM-ovi poput Prisme ne modeluju dobro, pa su obicne SQL
  migracije. Pokrece ih `scripts/migrate.ts` (`npm run db:migrate`), evidencija u tabeli
  `schema_migrations`. Svaka izmena seme = novi fajl (`002_...sql`), nikad izmena primenjenog fajla.
- **Upiti**: za sada obican `pg` (src/lib/db.ts, `withTenant()`); bez ORM-a. Ako postane naporno,
  predlozi Kysely i potvrdi sa vlasnikom.
- Hosting kasnije: Hetzner VPS, Docker Compose, Caddy ispred (automatski HTTPS).
- Slike: object storage (S3 ili Cloudflare R2), kompresija pri uploadu (WebP), kvote po salonu.
- Obavestenja: email (Resend/Postmark), kasnije SMS podsetnici.

## Arhitektura i tenancy

- **Tenant = organizacija** (`organizations`). Organizacija ima vise **lokacija** (`locations`).
- Tenant se odredjuje iz `Host` headera: prvo subdomen `slug.tvojsajt.rs`, kasnije custom domeni
  (`organization_domains`). Tenant NIKAD ne dolazi iz parametra koji salje korisnik.
- Svaka tabela sa podacima salona nosi `organization_id`. Svaki upit filtrira po njemu.
  Dodatna odbrana: Row Level Security (`SET LOCAL app.organization_id = '<uuid>'` na pocetku
  zahteva; aplikacija se konektuje ulogom koja nije vlasnik tabela).
- **Svi nalozi pripadaju jednom salonu** (`users.organization_id`): klijenti, zaposleni, menadzeri,
  vlasnik. Prijava je na domenu tog salona (`salon.rs/prijava`, panel `salon.rs/panel`); na
  `salon2.rs` taj nalog ne postoji (isti email = drugi nalog). Klijent salona zakazuje u svim
  njegovim objektima (lokacijama).
- **Nalog platforme** (`organization_id` NULL) ima samo vlasnik projekta; prijava samo na domenu
  platforme (`tvojsajt.rs/admin`, lokalno `localhost:3000/admin`). Saloni ga ne vide kao korisnika.
- Kolacici su vezani za domen, a sesija se dodatno proverava po salonu u bazi.

## Uloge i dozvole

- Nalog ima vise `memberships` (`scope`: platform / organization / location; `role`:
  admin, owner, manager, staff), samo u svom salonu (trigger u bazi); `admin` samo na platformi.
  Klijenti su obicni nalozi bez clanstva. Nalozi vlasnika/zaposlenih/admina: `npm run user:create`.
- Dozvole su granularne (`content.edit`, `gallery.edit`, `prices.edit`, `services.edit`,
  `locations.manage`, `staff.manage`, `schedule.manage`, `appointments.manage`, `clients.view`).
  Podrazumevano po ulozi u `role_permissions`, izuzeci po salonu u
  `organization_permission_overrides` (admin ih menja prekidacima).
- **Admin (vlasnik projekta) za pocetak sam menja sadrzaj, slike i cenovnik**; vlasnik salona
  radi operativu (smene, odsustva, termini, zaposleni). Kasnije se vlasniku dodeljuju
  `content.edit` / `prices.edit` prekidacem po salonu.
- **Provera dozvola je na backendu**, u jednoj centralnoj funkciji `can(actor, permission, resource, rules)`
  (`src/lib/auth/permissions.ts`; u route handlerima `authorize()` iz `src/lib/auth/actor.ts`).
  Sakrivanje dugmadi na frontendu nije zastita. "Samo svoje" (zaposleni) proveravaj i nad
  konkretnim objektom (`own_only`).
- Admin "ulazi u salon" eksplicitno (izabere salon, pamti se u sesiji).
- **Audit log** (`audit_log`): ko, kada, sta, staro/novo; pisi u istoj transakciji kao promena
  (posebno cene i usluge).

## Model podataka (sazetak, vidi `db/migrations/001_init.sql`)

- Usluge: katalog na nivou organizacije (`services`), **cena i trajanje po lokaciji**
  (`location_services`). Ko radi koju uslugu: `staff_services` (opciono trajanje po zaposlenom).
- Smene: `shift_templates` po lokaciji (vlasnik definise, ne tvrdo kodiraj "prva/druga"),
  `weekly_schedule` (nedeljni obrazac), `schedule_exceptions`, `time_off` (pauze, odsustva).
- Zaposleni (`staff`) je profil; nalog (`user_id`) je opcion. Moze da radi na vise lokacija.
- Termini (`appointments`): registrovan klijent (`client_user_id`) ILI gost (ime + telefon).
  Cena, naziv i trajanje se kopiraju u termin (snapshot). Duplo zakazivanje spreceno bazom:
  exclusion constraint `no_double_booking` (`staff_id` + `tstzrange`).
- Gost-termin pocinje kao `pending` i istice (`pending_expires_at`): treba pozadinski posao koji
  istekle prebacuje u otkazane. Gost potvrdjuje SMS kodom ili email linkom; svaki termin ima
  link za otkazivanje bez logovanja (cuva se samo hash tokena).
- Sadrzaj sajta: `site_content` (kljuc-vrednost, dozvoljeni kljucevi definisani u kodu),
  `site_content_history`, `media`, `gallery_items`. Cenovnik se generise iz `location_services`.
- Pojednostavljenja u MVP-u: jedna smena po danu po zaposlenom, smene ne prelaze ponoc,
  jedna usluga po terminu.

## Racunanje slobodnih termina (srce proizvoda)

Radi na backendu, jedna dobro testirana cista funkcija sa jedinicnim testovima:
1. Smena zaposlenog na lokaciji tog dana (`schedule_exceptions` ima prednost nad `weekly_schedule`).
2. Oduzmi `time_off`.
3. Oduzmi postojece termine sa statusom `pending` i `confirmed`.
4. U preostalim intervalima generisi pocetke u koraku `locations.slot_step_min`, samo gde cela
   usluga (trajanje + `buffer_min`) staje.
5. "Bilo koji radnik": spoji slobodne termine svih koji rade tu uslugu, pri zakazivanju dodeli nekog.
Pazi na vremensku zonu lokacije (`Europe/Belgrade`) i prelaz na letnje/zimsko vreme.
Konacnu zastitu daje baza (constraint), ne samo kod: hvataj gresku constraint-a i vrati
korisniku "termin je upravo zauzet".

## Sajt salona (vitrina)

Stranice: Pocetna, O nama (+ tim), Cenovnik (iz baze, tabovi po lokaciji), Kontakt/lokacije,
Galerija, Zakazivanje (lokacija, usluga, radnik, termin, podaci), Prijava/registracija i Moj nalog
(istorija termina, "Zakazi isto"). Samo sadrzaj iz polja, nikad slobodan page builder.
Pazi na kontrast boje teksta na primarnoj boji salona.

## Trenutno stanje (azurirati posle svakog vecog koraka)

Gotovo i **provereno** na pravoj bazi (Postgres 16 u Dockeru, Next 16.4, `package-lock.json` u repou).
`npm test`: 61 jedinicni test; `npm run test:db`: 15 integracionih testova; typecheck i `next build` prolaze;
migracije (001-003) prolaze na praznoj bazi.
- `src/lib/availability/`: `time.ts` (zone, DST, datumi), `schedule.ts` (`resolveShift`),
  `slots.ts` (`computeSlots`, `mergeStaffSlots`, `pickStaff`), `load.ts` (SQL upiti, `isBookableDate`).
- `src/lib/tenant-key.ts`, `src/lib/tenant.ts`: Host -> slug / custom domen / platforma.
- `src/lib/db.ts` (`withTenant()`), `scripts/migrate.ts`, `scripts/run-sql.ts`, `db/seed/dev_seed.sql`.
- `GET /api/health`, `GET /api/availability`.
- **Zakazivanje gosta** (korak 3, odluke u `docs/zakazivanje.md`): `POST /api/appointments`,
  `POST /api/appointments/confirm|cancel` (token iz linka), stranica `/termin/[token]`,
  `npm run jobs:expire-pending`, migracija `002_appointment_booking.sql`. Kod u `src/lib/appointments/`.
  Trka dva zahteva za isti termin je pokrivena testom (`booking.dbtest.ts`): `23P01` -> `slot_taken`,
  a kod "bilo koji radnik" prelazi na sledeceg slobodnog.
- **Autentifikacija i dozvole** (korak 2, `docs/autentifikacija.md`): Better Auth u `src/lib/auth/`
  (`auth.ts` konfiguracija, `realm.ts` prostor iz Host headera, `adapter.ts` filter po salonu,
  `session.ts`, `permissions.ts` `can()`, `actor.ts` ucitavanje + `authorize()`, `guards.ts`),
  `src/lib/audit.ts` (`writeAudit`), migracija `003_auth.sql`, skripta `npm run user:create`.
  Stranice: salon `/prijava`, `/registracija`, `/nalog`, `/panel`; platforma `/admin/prijava`, `/admin`
  (izbor salona, `POST /api/admin/active-organization`, upisuje se u audit log).
  Provereno preko HTTP-a: isti email u dva salona su dva naloga, kolacic jednog salona ne vazi
  u drugom ni na platformi, nalozi salona se ne mogu prijaviti na platformu i obrnuto.
- **Panel: termini** (korak 4, deo 1, `docs/panel.md`): `/panel/termini` (dnevni prikaz po lokaciji
  i radniku, promena statusa, unos termina telefonom koji je odmah potvrdjen). Izmene su Server
  Actions kroz `runPanelAction()` (`src/lib/panel/context.ts`), dozvola nad objektom iz baze
  (`ctx.require`), audit u istoj transakciji. Logika u `src/lib/panel/` (`core.ts`, `appointments.ts`).

Poznate odluke i ogranicenja algoritma:
- `appointments.ends_at` = pocetak + trajanje + buffer; sama usluga mora da stane u smenu, buffer ne mora.
- Minimalno vreme unapred 30 min, horizont 90 dana (`load.ts`), kasnije podesavanje salona.
- `pending` termini zauzimaju slot (kao i constraint u bazi) dok ih ne istekne `jobs:expire-pending`
  ili sledece zakazivanje u tom salonu (rok 15 min).
- Email jos ne ide: `src/lib/notify.ts` u razvoju ispisuje link u konzolu servera.
- Integracioni testovi su `*.dbtest.ts` (`npm run test:db`), jedinicni `*.test.ts` (`npm test`, bez baze).
- Lokalni docker korisnik je superuser, pa RLS tu ne filtrira; za produkciju napraviti posebnu
  ulogu aplikacije koja nije vlasnik tabela.

## Redosled gradnje

1. ~~Kostur Next.js, konekcija na bazu, migracije, tenant resolution~~ (gotovo, provereno)
2. ~~Autentifikacija, uloge, `can()`, audit log~~ (gotovo, vidi `docs/autentifikacija.md`).
3. ~~Zakazivanje gosta~~ (gotovo, vidi `docs/zakazivanje.md`). Ostaje: zakazivanje za ulogovanog
   klijenta (`client_user_id`, bez potvrde emailom) i istorija termina u "Moj nalog".
   Pre produkcije: rate limit, email provajder, odluka o rezervacijama za salone u statusu `draft`.
4. Panel vlasnika/zaposlenih: kalendar, termini, zaposleni, smene, odsustva. **U toku.**
   Gotovo: termini. Sledi: smene (sabloni, nedeljni raspored, izuzeci), odsustva, zaposleni.
   Svaka izmena kroz `runPanelAction()` / `ctx.require()` i `writeAudit()` u istoj transakciji.
5. Admin panel: izbor salona, uredjivanje sadrzaja, galerije, cena.
6. Javni sajt salona sa sadrzajem iz baze, SEO.
7. Email obavestenja, pa SMS. Zatim custom domeni, Dockerfile i deploy na Hetzner.

## Lokalno pokretanje

Potrebno: Git, Docker Desktop (pokrenut), Node.js 22+ (LTS). Windows projekat: `E:\salon`.
```
cp .env.example .env              (PowerShell: Copy-Item .env.example .env)
npm install
docker compose up -d              # PostgreSQL
npm run db:migrate                # primeni migracije
npm run db:seed                   # probni salon "demo" (opciono)
npm run user:create '--' --platform-admin --email ti@primer.rs --name "Ime"   # tvoj admin nalog
npm run dev                       # salon: http://demo.localhost:3000, platforma: http://localhost:3000/admin
npm test                          # jedinicni testovi (bez baze)
npm run test:db                   # integracioni testovi (baza mora da radi)
npm run typecheck
```
`*.localhost` radi u Chrome/Edge/Firefox bez podesavanja hosts fajla.
Provera: `http://localhost:3000/api/health`. Primer: vidi komentar na vrhu `db/seed/dev_seed.sql`.
Reset baze: `docker compose down -v`, pa `up -d` i `npm run db:migrate`.

## Pravila rada

- Prvo kratak plan, pa implementacija u malim koracima; pitaj vlasnika kad je odluka njegova.
- Git: grana po funkciji (`feature/...`), jasne commit poruke na engleskom. Posle merge-a u `main`
  (glavna grana je `main`, ne `master`) uvek obrisi spojene grane, lokalno i na GitHub-u. Nikad ne commit-uj
  `.env`, kljuceve ni dump baze sa pravim podacima klijenata.
- Ne uvodi nove tehnologije ni biblioteke bez obrazlozenja.
- Pre zavrsetka zadatka pokreni `npm test` i `npm run typecheck`; za bazu proveri da migracije prolaze na praznoj bazi.
- Licni podaci klijenata (ime, telefon, email): minimum potrebnog, politika privatnosti i saglasnost
  (srpski Zakon o zastiti podataka o licnosti, GDPR ako se cilja EU).
- Odluke koje nisu ovde navedene dokumentuj u `docs/`.
