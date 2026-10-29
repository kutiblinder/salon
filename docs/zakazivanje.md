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
   Odgovor `201` sa terminom u statusu `pending`. U razvoju odgovor sadrži i `devManageUrl`,
   a isti link se ispisuje u konzolu servera (umesto emaila).
3. Gost otvara link `/termin/<token>` i potvrđuje (`POST /api/appointments/confirm`) ili otkazuje
   (`POST /api/appointments/cancel`), oba sa telom `{ "token": "..." }`.

Greške: `400` neispravan unos (`invalid_*`, `consent_required`), `404` salon/lokacija/usluga ne postoji,
`409 slot_unavailable` (termin nije u slobodnim terminima: van smene, van koraka, prošlost, > 90 dana),
`409 slot_taken` (neko je upravo zauzeo termin; hvata se greška `23P01` iz baze).

## Odluke

- **Gost mora da ostavi email** (pored imena i telefona): potvrda ide email linkom dok ne uvedemo SMS.
  Telefon se čuva u E.164 obliku (`+381641234567`).
- **Rok za potvrdu: 15 minuta** (`PENDING_TTL_MIN` u `src/lib/appointments/create.ts`).
- **Jedan token za potvrdu i otkazivanje.** U bazi je samo SHA-256 hash (`manage_token_hash`).
  Stranica sa tokenom ima `noindex` i `<meta name="referrer" content="no-referrer">`.
- **Istekao `pending` termin postaje `cancelled_by_client`** (nema posebnog statusa "istekao").
  Ističe ga `npm run jobs:expire-pending` (u produkciji cron svaki minut, ulogom koja zaobilazi RLS),
  a dodatno i svako novo zakazivanje u tom salonu pre provere slotova.
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
- Salon u `draft`: sajt se vidi, `GET /api/availability` i `POST /api/appointments` vraćaju 403.
- Limit: 10 zakazivanja po IP-u na sat.
