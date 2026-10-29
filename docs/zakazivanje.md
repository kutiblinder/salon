# Zakazivanje gosta (korak 3)

Odluke donete pri implementaciji koje nisu bile u `CLAUDE.md`. Svaku može da promeni vlasnik projekta.

## Tok

1. `GET /api/availability` vraća slobodne početke (`start`, ISO UTC).
2. `POST /api/appointments` sa telom:
   ```json
   {
     "locationId": "...", "serviceId": "...", "staffId": null,
     "start": "2026-11-02T07:00:00.000Z",
     "guest": { "name": "Petar Petrović", "phone": "064 123 4567", "email": "petar@example.com" },
     "note": "opciono",
     "privacyConsent": true
   }
   ```
   Odgovor `201`: `confirmed` (podrazumevano) ili `pending` ako salon traži potvrdu emailom.
   U razvoju odgovor sadrži i `devManageUrl`, a isti link se ispisuje u konzolu servera (umesto emaila).
3. Gost otvara link `/termin/<token>`: otkaz (`POST /api/appointments/cancel`) uvek; potvrda
   (`POST /api/appointments/confirm`) samo dok je `pending`.

Greške: `400` neispravan unos (`invalid_*`, `consent_required`), `404` salon/lokacija/usluga ne postoji,
`409 slot_unavailable` (termin nije u slobodnim terminima: van smene, van koraka, prošlost, > 90 dana),
`409 slot_taken` (neko je upravo zauzeo termin; hvata se greška `23P01` iz baze).

## Odluke

- **Gost mora da ostavi email** (pored imena i telefona): na njega stiže obaveštenje i link za otkazivanje.
  Telefon se čuva u E.164 obliku (`+381641234567`).
- **Potvrda emailom je prekidač po salonu** (`organizations.guest_confirm_email`, admin → Sadržaj).
  Isključeno: gost je odmah `confirmed`, email ima samo otkaz. Uključeno: `pending`, gost mora da
  potvrdi linkom u roku od **60 min** (`PENDING_TTL_MIN`); inače `jobs:expire-pending` oslobađa slot.
- **Jedan token za potvrdu i otkazivanje.** U bazi je samo SHA-256 hash (`manage_token_hash`).
  Stranica sa tokenom ima `noindex` i `<meta name="referrer" content="no-referrer">`.
- **Istekao `pending` postaje `cancelled_by_client`.** Ističe ga `npm run jobs:expire-pending`
  (u produkciji cron svaki minut), a dodatno i svako novo zakazivanje u tom salonu.
- **Otkazivanje je dozvoljeno do početka termina.** Kasnije podešavanje salona (npr. najkasnije 2 h ranije).
- **"Bilo koji radnik"**: bira se radnik sa najmanje termina tog dana (`pickStaff`); ako ga je neko
  upravo zauzeo, probaju se ostali slobodni u tom trenutku (savepoint + ponovni pokušaj).
- **Saglasnost o privatnosti** je obavezna (`privacyConsent: true`), vreme se čuva u
  `appointments.privacy_consent_at` (migracija `002`).
- **Email:** Resend kad je `RESEND_API_KEY` postavljen; inače u razvoju konzola, u produkciji upozorenje.

## Otvoreno (pre puštanja u rad)

- SMS kod kao alternativa email linku (Infobip ili sličan nalog).

## Ulogovani klijent i draft (dodato u koraku 6)

- Ulogovani klijent na domenu salona: `POST /api/appointments` bez `guest` polja, odmah `confirmed`, `client_user_id`.
- Salon u `draft`: `GET /api/availability` i `POST /api/appointments` vraćaju 403.
- Salon u `inactive`: sajt i API se ponašaju kao da salona nema (404 / „Sajt nije dostupan“).
- Limit: 10 zakazivanja po IP-u na sat.
