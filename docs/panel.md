# Panel vlasnika i zaposlenih (korak 4)

Panel je na domenu salona (`/panel`), samo za naloge tog salona koji imaju clanstvo
(vlasnik, menadzer, zaposleni). Admin platforme radi preko `/admin` (korak 5).

## Kako su izmene zasticene

- Izmene idu kroz **Server Actions** (`'use server'`), ne kroz posebne API rute: manje koda za
  forme, a Next sam odbija zahteve sa tudjeg domena (provera Origin/Host). Server Action je
  ipak javno dostupan POST, pa svaka akcija sama proverava sesiju i dozvole.
- `runPanelAction()` (`src/lib/panel/context.ts`): sesija sa ovog domena, clanstva i pravila
  ucitana iznova, sve u jednoj transakciji salona (`withTenant`) sa audit logom.
  `PanelError` vraca poruku korisniku i ponistava transakciju.
- Dozvola se proverava nad objektom **ucitanim iz baze** (`ctx.require(permission, {locationId, staffId})`),
  nikad nad ID-jem iz forme. Zaposleni sa `own_only` vidi i menja samo svoje termine.
- Logika panela bez Next-a je u `src/lib/panel/core.ts` i `appointments.ts` (testovi: `*.dbtest.ts`).

## Termini (`/panel/termini`)

- Dnevni prikaz po lokaciji, kolone po radniku (na telefonu jedna ispod druge).
- Prelazi statusa (`src/lib/appointments/status.ts`):
  - `pending -> confirmed` (salon potvrdi umesto gosta);
  - `pending/confirmed -> cancelled_by_salon`;
  - `confirmed -> completed / no_show` tek kad je termin poceo.
  Zavrseni i otkazani termini se ne menjaju.
- **Termin koji unese salon** (telefonom ili licno):
  - odmah je `confirmed`, a `created_by_user_id` = ko ga je uneo;
  - email je opcion i nema minimalnog vremena unapred (klijent moze biti vec u salonu);
  - saglasnost (`privacy_consent_at`) se ne belezi jer podatke unosi salon. Politika
    privatnosti salona treba da pokrije i ovaj slucaj;
  - zaposleni sa `own_only` zakazuje samo sebi; "bilo ko slobodan" trazi dozvolu nad celom lokacijom.
- Telefon i email klijenta se prikazuju samo uz `clients.view`.
- Za sada se klijentu ne salje obavestenje o terminu koji je uneo ili otkazao salon (korak 7).
