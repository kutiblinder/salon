# Probni nalozi (samo lokalno)

Lozinke su namerno jednostavne. Ne koristi ih na pravom serveru.

Prvo: `npm run db:seed` (sadržaj, nalozi, galerija), `npm run hosts:dev` (Administrator), `npm run dev`.

Galerija na svakom sajtu: `/galerija` (po 3 slike).

## pgAdmin (baza)

http://127.0.0.1:5050 — `admin@admin.rs` / `admin`

Server `salon` je već dodat. Lozinka za Postgres je `POSTGRES_PASSWORD` iz `.env` (podrazumevano `promeni_me`). Host u kontejneru je `db`, ne `localhost`.

## Platforma (svi saloni)

| | |
|---|---|
| Sajt | http://localhost:3000/admin |
| Uloga | admin (jedan nalog za sve salone) |
| Email | `admin@admin.rs` |
| Lozinka | `admin` |

Posle prijave izaberi salon (Demo / Salon dva / Salon tri).

## Demo Salon — http://localhost.rs:3000

Panel: http://localhost.rs:3000/panel

| Uloga | Ime | Email | Lozinka |
|---|---|---|---|
| Vlasnik | Vlasnik Demo | `vlasnik@localhost.rs` | `vlasnik` |
| Zaposleni | Marko | `zaposleni@localhost.rs` | `zaposleni` |
| Mušterija | Petar Petrović | `musterija@localhost.rs` | `musterija` |

## Salon dva — http://sajt2.rs:3000

Panel: http://sajt2.rs:3000/panel

| Uloga | Ime | Email | Lozinka |
|---|---|---|---|
| Vlasnik | Vlasnik Dva | `vlasnik@sajt2.rs` | `vlasnik` |
| Zaposleni | Ana | `zaposleni@sajt2.rs` | `zaposleni` |
| Mušterija | Mila Jovanović | `musterija@sajt2.rs` | `musterija` |

## Salon tri — http://sajt3.rs:3000

Panel: http://sajt3.rs:3000/panel

| Uloga | Ime | Email | Lozinka |
|---|---|---|---|
| Vlasnik | Vlasnik Tri | `vlasnik@sajt3.rs` | `vlasnik` |
| Zaposleni | Ivana | `zaposleni@sajt3.rs` | `zaposleni` |
| Mušterija | Nikola Ilić | `musterija@sajt3.rs` | `musterija` |

Nalog sa jednog sajta ne važi na drugom. Admin se prijavljuje samo na `localhost:3000/admin`, ne na sajtu salona.
