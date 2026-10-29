# Javni sajt salona (korak 6)

Isti izgled za sve salone. Tenant iz `Host` headera, nikad iz URL parametra.

## Stranice

- `/` početna (tekstovi iz `site_content`)
- `/o-nama` + tim (`staff`)
- `/cenovnik` iz `location_services` (tabovi ako ima više objekata)
- `/galerija` (`/api/media/:id`)
- `/kontakt` svi aktivni objekti (adresa, telefon, radno vreme)
- `/zakazivanje` čarobnjak (objekat, usluga, radnik, kalendar, slot, podaci).
  Izbor objekta samo ako salon ima više objekata sa cenom; jedan se bira sam.
  Kalendar ne nudi prošle dane, dane bez smene i dane bez slobodnog slota.
- `/prijava`, `/registracija`, `/nalog` (istorija + „Zakaži isto“ + otkaz)
- `/privatnost`

## Pravila

- Salon u statusu `draft`: sajt se vidi (pregled), zakazivanje i `GET /api/availability` su zabranjeni.
- Salon u statusu `inactive`: sajt je ugašen (`Sajt nije dostupan.`), nema prijave, panela ni
  zakazivanja. Admin na platformi može ponovo da ga objavi.
- Gost (bez naloga): ime, prezime, telefon i email. Ako salon ima `guest_confirm_email`, termin je
  `pending` dok gost ne potvrdi linkom (1 sat); inače odmah `confirmed` + email sa otkazom.
  Ulogovani klijent: ime i telefon sa naloga, odmah `confirmed`, `client_user_id`.
- Limit: 10 `POST /api/appointments` po IP-u na sat.
- Schema.org iz `theme.schemaType` (`HairSalon` / `DaySpa` / `NailSalon`). Naslov npr. „Cenovnik · Atelje Kosić“.
- Primarna boja iz `organizations.theme.primaryColor`; kontrast teksta kao u adminu.

## Lokalno: sopstveni domen po salonu

Svaki salon se otvara na svom hostu (i na `.localhost` slug-u):

1. `npm run db:seed` (upisuje `ateljekosic.rs`, `zenmasaza.rs`, `bellanails.rs`)
2. `npm run hosts:dev` (PowerShell **kao Administrator**) — `127.0.0.1` u hosts fajl
3. `npm run dev` (`allowedDevOrigins` u `next.config.ts` da JS radi na tim domenima), pa:
   - http://ateljekosic.rs:3000 — Atelje Kosić (frizer; i atelje.localhost:3000)
   - http://zenmasaza.rs:3000 — Zen Masaža (i zen.localhost:3000)
   - http://bellanails.rs:3000 — Bella Nails (i bella.localhost:3000)
   - http://localhost:3000/admin — platforma

## Email

`RESEND_API_KEY` + `EMAIL_FROM`. Bez ključa u razvoju ide u konzolu servera. SMS nije u ovom koraku
(treba nalog kod provajdera, npr. Infobip).
