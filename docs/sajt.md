# Javni sajt salona (korak 6)

Isti izgled za sve salone. Tenant iz `Host` headera, nikad iz URL parametra.

## Stranice

- `/` početna (tekstovi iz `site_content`)
- `/o-nama` + tim (`staff`)
- `/cenovnik` iz `location_services` (tabovi ako ima više objekata)
- `/galerija` (`/api/media/:id`)
- `/kontakt` adresa, telefon, radno vreme (`location_hours`)
- `/zakazivanje` čarobnjak (objekat, usluga, radnik, datum, slot, podaci)
- `/prijava`, `/registracija`, `/nalog` (istorija + „Zakaži isto“ + otkaz)
- `/privatnost`

## Pravila

- Salon u statusu `draft`: sajt se vidi (pregled), zakazivanje i `GET /api/availability` su zabranjeni.
- Gost (bez naloga): ime, prezime, telefon i email; `pending` + email link. Ulogovani klijent:
  ime i telefon se popunjavaju sa naloga, odmah `confirmed`, `client_user_id`.
- Limit: 10 `POST /api/appointments` po IP-u na sat.
- Schema.org `HairSalon` na svakoj stranici salona. Naslov npr. „Cenovnik · Demo Salon“.
- Primarna boja iz `organizations.theme.primaryColor`; kontrast teksta kao u adminu.

## Lokalno: sopstveni domen po salonu

Nije obavezan `demo.localhost`. Svaki salon se otvara na svom hostu:

1. `npm run db:seed` (upisuje `localhost.rs`, `sajt2.rs`, `sajt3.rs`)
2. `npm run hosts:dev` (PowerShell **kao Administrator**) — `127.0.0.1` u hosts fajl
3. `npm run dev` (`allowedDevOrigins` u `next.config.ts` da JS radi na tim domenima), pa:
   - http://localhost.rs:3000 — Demo Salon
   - http://sajt2.rs:3000 — Salon dva
   - http://sajt3.rs:3000 — Salon tri
   - http://localhost:3000/admin — platforma

## Email

`RESEND_API_KEY` + `EMAIL_FROM`. Bez ključa u razvoju ide u konzolu servera. SMS nije u ovom koraku
(treba nalog kod provajdera, npr. Infobip).
