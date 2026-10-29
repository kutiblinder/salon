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

Posle prijave izaberi salon (Atelje Kosić / Zen Masaža / Bella Nails).

## Atelje Kosić (frizer) — http://ateljekosic.rs:3000

Ili http://atelje.localhost:3000. Dva objekta: Zemun i Novi Beograd.

Panel: http://ateljekosic.rs:3000/panel

| Uloga | Ime | Email | Lozinka |
|---|---|---|---|
| Vlasnik | Milan Kosić | `vlasnik@ateljekosic.rs` | `vlasnik` |
| Zaposleni | Marko Kosić | `zaposleni@ateljekosic.rs` | `zaposleni` |
| Zaposleni | Jovana Kosić | `jovana@ateljekosic.rs` | `zaposleni` |
| Mušterija | Petar Petrović | `musterija@ateljekosic.rs` | `musterija` |

## Zen Masaža — http://zenmasaza.rs:3000

Ili http://zen.localhost:3000. Objekat na Vračaru (Njegoševa).

Panel: http://zenmasaza.rs:3000/panel

| Uloga | Ime | Email | Lozinka |
|---|---|---|---|
| Vlasnik | Jelena Simić | `vlasnik@zenmasaza.rs` | `vlasnik` |
| Zaposleni | Ana Simić | `zaposleni@zenmasaza.rs` | `zaposleni` |
| Zaposleni | Nemanja Ilić | `nemanja@zenmasaza.rs` | `zaposleni` |
| Mušterija | Mila Jovanović | `musterija@zenmasaza.rs` | `musterija` |

## Bella Nails (manikir / pedikir) — http://bellanails.rs:3000

Ili http://bella.localhost:3000. Objekat u Starom gradu. **Gost mora da potvrdi termin emailom** (rok 1 sat).

Panel: http://bellanails.rs:3000/panel

| Uloga | Ime | Email | Lozinka |
|---|---|---|---|
| Vlasnik | Bella Petrović | `vlasnik@bellanails.rs` | `vlasnik` |
| Zaposleni | Ivana Petrović | `zaposleni@bellanails.rs` | `zaposleni` |
| Zaposleni | Milica Jovanović | `milica@bellanails.rs` | `zaposleni` |
| Mušterija | Nikola Ilić | `musterija@bellanails.rs` | `musterija` |

Nalog sa jednog sajta ne važi na drugom. Admin se prijavljuje samo na `localhost:3000/admin`, ne na sajtu salona.
