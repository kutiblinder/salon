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
- Autentifikacija: gotovo resenje (npr. Auth.js), ne pisati od nule.
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
- Kolacici su vezani za domen: nalog klijenta je za pocetak **po salonu**.

## Uloge i dozvole

- Jedan `users` nalog, vise `memberships` (`scope`: platform / organization / location; `role`:
  admin, owner, manager, staff). Klijenti su obicni nalozi bez clanstva.
- Dozvole su granularne (`content.edit`, `gallery.edit`, `prices.edit`, `services.edit`,
  `locations.manage`, `staff.manage`, `schedule.manage`, `appointments.manage`, `clients.view`).
  Podrazumevano po ulozi u `role_permissions`, izuzeci po salonu u
  `organization_permission_overrides` (admin ih menja prekidacima).
- **Admin (vlasnik projekta) za pocetak sam menja sadrzaj, slike i cenovnik**; vlasnik salona
  radi operativu (smene, odsustva, termini, zaposleni). Kasnije se vlasniku dodeljuju
  `content.edit` / `prices.edit` prekidacem po salonu.
- **Provera dozvola je na backendu**, u jednoj centralnoj funkciji `can(user, action, resource)`.
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

Gotovo i **provereno** (33 jedinicna testa prolaze, `npm test`):
- `src/lib/availability/`: `time.ts` (zone, DST, datumi), `schedule.ts` (`resolveShift`),
  `slots.ts` (`computeSlots`, `mergeStaffSlots`, `pickStaff`). Cista logika, bez baze.
- `src/lib/tenant-key.ts`: Host -> slug / custom domen / platforma.

Napisano, ali **jos NIJE pokrenuto na pravoj bazi ni sa `npm install`** (prvi zadatak: pokreni,
ispravi greske, dopuni testove):
- Next.js kostur (`src/app`, `package.json`, `tsconfig.json`, Tailwind 4), `src/lib/db.ts`,
  `src/lib/tenant.ts`, `src/lib/availability/load.ts` (SQL upiti), `GET /api/availability`,
  `GET /api/health`, `scripts/migrate.ts`, `scripts/run-sql.ts`, `db/seed/dev_seed.sql`.
- Verzije u `package.json` su opsezi (Next ^16, React ^19, Tailwind ^4); posle `npm install`
  commit-uj `package-lock.json`.

Poznate odluke i ogranicenja algoritma:
- `appointments.ends_at` = pocetak + trajanje + buffer; sama usluga mora da stane u smenu, buffer ne mora.
- Minimalno vreme unapred 30 min, horizont 90 dana (`load.ts`), kasnije podesavanje salona.
- `pending` termini zauzimaju slot (kao i constraint u bazi): treba posao za istek `pending_expires_at`.
- Lokalni docker korisnik je superuser, pa RLS tu ne filtrira; za produkciju napraviti posebnu
  ulogu aplikacije koja nije vlasnik tabela.

## Redosled gradnje

1. ~~Kostur Next.js, konekcija na bazu, migracije, tenant resolution~~ (napisano, treba pokrenuti)
2. Autentifikacija, uloge, `can()`, audit log.
3. **Zakazivanje**: `POST /api/appointments` (transakcija, snapshot cene/trajanja, hvatanje
   exclusion greske `23P01` -> "termin je upravo zauzet", gost potvrda, link za otkazivanje).
   Algoritam slobodnih termina je gotov (vidi iznad).
4. Panel vlasnika/zaposlenih: kalendar, termini, zaposleni, smene, odsustva.
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
npm run dev                       # http://demo.localhost:3000
npm test                          # jedinicni testovi (bez baze)
npm run typecheck
```
`*.localhost` radi u Chrome/Edge/Firefox bez podesavanja hosts fajla.
Provera: `http://localhost:3000/api/health`. Primer: vidi komentar na vrhu `db/seed/dev_seed.sql`.
Reset baze: `docker compose down -v`, pa `up -d` i `npm run db:migrate`.

## Pravila rada

- Prvo kratak plan, pa implementacija u malim koracima; pitaj vlasnika kad je odluka njegova.
- Git: grana po funkciji (`feature/...`), jasne commit poruke na engleskom. Nikad ne commit-uj
  `.env`, kljuceve ni dump baze sa pravim podacima klijenata.
- Ne uvodi nove tehnologije ni biblioteke bez obrazlozenja.
- Pre zavrsetka zadatka pokreni `npm test` i `npm run typecheck`; za bazu proveri da migracije prolaze na praznoj bazi.
- Licni podaci klijenata (ime, telefon, email): minimum potrebnog, politika privatnosti i saglasnost
  (srpski Zakon o zastiti podataka o licnosti, GDPR ako se cilja EU).
- Odluke koje nisu ovde navedene dokumentuj u `docs/`.
