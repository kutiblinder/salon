# Admin panel platforme (korak 5)

Admin je na domenu platforme (`/admin`, lokalno `http://localhost:3000/admin`). Saloni ga ne vide
kao korisnika. Prijava: nalog sa `organization_id` NULL i ulogom `admin` na platformi.

## Ulazak u salon

- Admin eksplicitno bira salon (`POST /api/admin/active-organization`). ID se cuva u
  `sessions.active_organization_id`, **nikad u URL-u ni u telu kasnijih formi**.
- Sve izmene u salonu idu kroz `runAdminAction()` (`src/lib/admin/context.ts`): sesija sa ovog
  domena, aktivan salon iz sesije, `withTenant(taj salon)`, `can()` iznova, audit u istoj transakciji.
- Novi salon ide kroz `runPlatformAction()` (nema ulaska unapred). Posle upisa admin ulazi u taj salon.
- Bez izabranog salona nema `content.edit` (vidi `can()`: admin radi samo u salonu u koji je usao).

## Novi salon (`/admin`)

- Forma na listi salona: naziv, slug (poddomen), opciono ime prvog objekta (inače = naziv salona).
- Status je `draft` dok ga ne objavite u Sadržaju. Pravi se i prva lokacija (`Europe/Belgrade`, korak 15 min).
- Brisanje salona (potvrda u pregledaču): ako ima buduće `pending`/`confirmed` termine, odbija se.
  Inače se brišu termini, nalozi tog salona i slike sa diska. Sesija admina izlazi iz salona.
- Slug: `[a-z0-9-]` 2–50 znakova, rezervisan `www` / `admin` / `api`. Lokalno: `slug.localhost:3000` ili
  `npm run hosts:dev` za custom host.

## Objekti (`/admin/objekti`)

- Dozvola `locations.manage` (admin). Naziv, adresa, grad, telefon, email, korak termina, radno vreme.
- Novi objekat kopira cene sa postojećeg (ako ih ima). Zaposlene i smene i dalje dodeljujete u panelu.
- Deaktivacija: bar jedan objekat mora ostati aktivan. Brisanje: bar jedan objekat mora ostati
  (i aktivan i neaktivan). Objekat sa budućim zakazanim terminima se ne briše; prošli termini
  na njemu se obrišu.
- Kontakt i cenovnik prikazuju sve aktivne objekte. Zakazivanje nudi izbor samo kad ima **više**
  objekata sa cenom; jedan objekat se bira sam.

## Nalozi (`/admin/nalozi`)

- Samo dok je admin ušao u salon. Vlasnik, menadžer ili zaposleni (članstvo na nivou salona).
- Novi nalog: ime, email, uloga, opciona lozinka (prazno = sistem je napravi; prikaže se jednom).
- Ako email već postoji u tom salonu (npr. klijent), dodaje se uloga, lozinka se ne menja.
- Uloga **zaposleni** pravi i `staff` profil na svim aktivnim objektima (da može da prima termine).
- Prijava je na sajtu salona (`salon.rs/prijava`), ne na `/admin`. Lozinka nije u audit logu.
- I dalje radi `npm run user:create` za skripte i nalog platforme.

## Zaposleni (`/admin/zaposleni`)

- Lista, novi profil i izmena (`/admin/zaposleni/[id]`): ime, titula, opis, redosled, aktivan,
  objekti, usluge, nalog za prijavu. Ista logika kao panel (`src/lib/panel/staff.ts`).
  Promena imena ažurira i `users.full_name` ako postoji nalog.
- Deaktivacija: profil ostaje, nema prijave ni zakazivanja kod njega (sesije se brišu).
  Brisanje: odbija se ako ima buduće termine; inače se brišu termini tog zaposlenog, profil i
  nalog za prijavu (osim ako je isti nalog vlasnik/menadžer).

## Sadrzaj (`/admin/sadrzaj`)

- Dozvola `content.edit` (samo admin, dok vlasniku ne ukljucis prekidac).
- Naziv salona, poddomen (`slug`), status sajta (`draft` / `published` / `inactive`), primarna boja (`organizations.theme.primaryColor`),
  prekidač „gost mora da potvrdi termin emailom“ (`guest_confirm_email`, rok 1 sat).
  Neaktivan: sajt je ugašen (nema sadržaja, prijave ni panela) dok ga ne vratite na objavljen —
  npr. kad salon nije platio. Sesije tog salona se brišu.
  Kontrast belog/crnog teksta na toj boji se racuna u `src/lib/admin/theme.ts`.
- Tekstovi: `site_content` kljuc-vrednost. Dozvoljeni kljucevi su u kodu (`CONTENT_FIELDS` u
  `src/lib/admin/content-types.ts`). Svaka izmena polja ide u `site_content_history`.
- Logo i favicon nisu ovde (kasnije, isti mehanizam kao galerija). Custom domen: `/admin/domeni`.

## Cenovnik (`/admin/cene`)

- Dozvole `services.edit` (katalog) i `prices.edit` (cena/trajanje/buffer po objektu). Admin ima obe.
- Usluga na nivou salona (`services`); cena, trajanje i pauza po lokaciji (`location_services`), valuta RSD.
- Bar jedan objekat. Skidanje objekta brise red u `location_services` (postojeci termini zadrze snimak cene).
- Deaktivacija umesto brisanja. Kategorije usluga nisu u ovom koraku.

## Galerija (`/admin/galerija`)

- Dozvola `gallery.edit`. Slike se kompresuju u WebP (`sharp`), cuvaju na disku (`STORAGE_DIR`, podrazumevano `data/media`).
  Isti volume na Hetzneru; S3/R2 kad bude nalog (interfejs `src/lib/storage.ts`).
- Kvota: 40 slika, 5 MB original, 80 MB ukupno po salonu. Alt tekst je obavezan.
- Javni URL: `/api/media/<mediaId>` samo na domenu tog salona (ili admin u tom salonu).

## Domeni (`/admin/domeni`)

- Dozvola `content.edit`. Upis u `organization_domains`. Tenant i dalje samo iz `Host` headera.
- Posle DNS A/AAAA na VPS, admin oznaci domen kao proveren (`verified_at`). Caddy pita
  `GET /api/tls-ask?domain=` pre izdavanja sertifikata (samo platforma, postojeci slug, ili proveren domen).
- `www` i apex se tretiraju kao isti salon ako je jedan od njih u tabeli.
- Lokalno: `npm run hosts:dev`, pa npr. http://ateljekosic.rs:3000 (radi i `atelje.localhost`).

## Logovi (`/admin/logovi`)

- Pregled `audit_log` za salon u koji je admin usao (sesija, ne URL). Poslednjih 100 zapisa.
- Ko, kada (`Europe/Belgrade`), sta (akcija na srpskom), objekat, staro/novo. Lozinke i tokeni se ne prikazuju.
- Vlasnik salona ovo ne vidi (samo nalog platforme).
