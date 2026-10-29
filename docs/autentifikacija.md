# Autentifikacija, uloge i dozvole (korak 2)

## Odluke vlasnika (29. 10. 2026.)

- **Biblioteka: Better Auth** umesto Auth.js. Auth.js je od septembra 2025. deo Better Auth-a,
  v5 je i dalje beta i dobija samo sigurnosne ispravke; oba tima preporučuju Better Auth za nove projekte.
- **Prijava: email + lozinka.** Prijava linkom na email i Google nalogom dolaze kasnije
  (link traži email provajdera).
- **Nalozi su potpuno odvojeni po salonu.** `salon.rs` i `salon2.rs` su dva salona; klijent, zaposleni,
  menadžer i vlasnik sa `salon.rs` ne postoje na `salon2.rs`. Isti email na drugom salonu je drugi nalog
  sa drugom lozinkom. Salon može imati više objekata (lokacija); klijent salona zakazuje u svim.
- **Svi korisnici salona se prijavljuju na domenu salona** (`/prijava`; panel `/panel`).
  Neaktivan salon (`organizations.status = inactive`) nema prijavu. Neaktivan zaposleni
  (`staff.is_active = false`) ne može da se prijavi; vlasnik/menadžer i dalje može.
- **Vlasnik projekta (admin) ima jedan nalog platforme**, prijava samo na domenu platforme (`/admin`),
  bira salon u koji ulazi; saloni ga ne vide kao korisnika.

## Kako je izvedeno

- `users.organization_id`: salon naloga; `NULL` = nalog platforme. Email je jedinstven po
  `(organization_id, email)` (`NULLS NOT DISTINCT`, pa i na platformi samo jednom).
- **Prostor (realm)** zahteva se određuje iz `Host` headera (`src/lib/auth/realm.ts`): domen platforme
  ili salon. Better Auth rute i čitanje sesije uvek rade unutar `runInRealm()`.
- **Omotač oko Better Auth adaptera** (`src/lib/auth/adapter.ts`) svakom upitu nad `users`, `sessions`
  i `accounts` dodaje `organization_id = <salon iz Host-a>` (ili `IS NULL` za platformu), a pri upisu
  postavlja `organization_id` bez obzira na ulaz. Bez postavljenog prostora upit baca grešku.
  Zato isti email može postojati u dva salona, a sesija jednog salona ne važi u drugom ni kad bi
  neko ručno preneo kolačić (provereno testom).
- Baza dodatno čuva granice (migracija `003_auth.sql`):
  - `sessions`/`accounts` imaju složeni FK `(user_id, organization_id)` na korisnika;
  - `staff.user_id` i `appointments.client_user_id` samo nalog istog salona;
  - trigger na `memberships`: uloga samo u sopstvenom salonu, lokacija iz tog salona, `admin` samo na platformi.
- Kolačići: prefiks `salon`, vezani za domen (bez `Domain` atributa), `Secure` u produkciji.
  Better Auth odbija POST sa tuđeg `Origin`-a (CSRF); dozvoljen je samo isti domen.
- Lozinke: scrypt (Better Auth), u `accounts.password`. Najmanje 8 znakova. Better Auth ima ugrađen
  rate limit za prijavu (u produkciji, memorija procesa; za više instanci treba deljeno skladište).

## Registracija i nalozi

- **Klijent** se registruje sam na sajtu salona: ime, email, telefon (normalizuje se u `+381...`),
  lozinka i obavezna saglasnost (`users.privacy_consent_at`). Email se za sada ne potvrđuje
  (nema email provajdera).
- **Na domenu platforme nema registracije.** Vlasnike, menadžere i zaposlene admin dodaje u
  `/admin/nalozi` (kad uđe u salon). Nalog platforme i skripte i dalje:

  ```powershell
  npm run user:create '--' --platform-admin --email ti@primer.rs --name "Ime Prezime"
  npm run user:create '--' --org demo --role owner --email vlasnik@primer.rs --name "Vlasnik"
  npm run user:create '--' --org demo --role staff --email marko@primer.rs --name "Marko" --staff <staff-id>
  npm run user:create '--' --org demo --role manager --location <location-id> --email ... --name ...
  ```
  `'--'` je pod navodnicima zbog PowerShell-a. Vlasnik u panelu i dalje veže nalog zaposlenom (`/panel/zaposleni`).

## Dozvole: `can()`

`can(actor, permission, resource, rules)` u `src/lib/auth/permissions.ts` (čista funkcija, testovi u
`permissions.test.ts`). U route handleru: `authorize(request.headers, 'prices.edit', { organizationId, locationId, staffId })`
iz `src/lib/auth/actor.ts` vraća `401`/`403` ili prijavljenog korisnika.

- Admin platforme ima dozvole uloge `admin`, ali **samo u salonu u koji je ušao** (`sessions.active_organization_id`).
  Izuzeci po salonu ne oduzimaju dozvole adminu.
- Ostali: nalog mora biti iz istog salona; članstvo na nivou lokacije važi samo za tu lokaciju
  (resurs bez lokacije ga ne zadovoljava).
- Izuzetak po salonu (`organization_permission_overrides`) ima prednost nad podrazumevanom dozvolom uloge.
- "Samo svoje" (`own_only`, zaposleni): `resource.staffId` mora biti profil zaposlenog ovog naloga.
  `resource` se puni iz baze (konkretan objekat), nikad iz zahteva.

## Audit log

`writeAudit(client, {...})` iz `src/lib/audit.ts`, pozivati istim klijentom (transakcijom) kao i promenu.
Već se upisuju: pravljenje naloga skriptom (`user.create`) i ulazak/izlazak admina iz salona.

## Lokalno

- Domen platforme: `http://localhost:3000` (`/admin`). Salon: npr. `http://ateljekosic.rs:3000` (`/prijava`).
  Prečica `DEV_TENANT_SLUG` (goli localhost prikazuje demo salon) je uklonjena, jer je goli localhost
  sada domen platforme.
- `.env` mora imati `BETTER_AUTH_SECRET` (vidi `.env.example`).

## Otvoreno

- Zaboravljena lozinka i potvrda emaila: kad bude tok za reset (Resend vec salje zakazivanje).
- Rate limit u produkciji sa više instanci: deljeno skladište (npr. Postgres tabela).
