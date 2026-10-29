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
- Gost: `pending` + email link. Ulogovani klijent: odmah `confirmed`, `client_user_id`.
- Limit: 10 `POST /api/appointments` po IP-u na sat.
- Schema.org `HairSalon` na svakoj stranici salona. Naslov npr. „Cenovnik · Demo Salon“.
- Primarna boja iz `organizations.theme.primaryColor`; kontrast teksta kao u adminu.

## Email

`RESEND_API_KEY` + `EMAIL_FROM`. Bez ključa u razvoju ide u konzolu servera. SMS nije u ovom koraku
(treba nalog kod provajdera, npr. Infobip).
