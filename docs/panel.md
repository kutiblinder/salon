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

## Smene (`/panel/smene`)

- **Sabloni** po lokaciji (`shift_templates`): naziv + pocetak/kraj u istom danu (MVP ne podrzava smenu preko ponoci).
  Menja ih nalog sa `schedule.manage` nad celom lokacijom (vlasnik/menadzer). Zaposleni sa
  `own_only` vidi sablone, ne menja ih. Brisanje je zabranjeno dok sablon stoji u rasporedu
  ili izuzetku (inace bi CASCADE obrisao te redove).
- **Nedeljni raspored** (`weekly_schedule`): jedna smena dnevno po radniku (PK `staff_id + weekday`).
  "Ne radi" na ovoj lokaciji ne dira unos na drugoj. Izbor sablona ovde prepisuje dan koji je
  bio na drugom objektu.
- **Izuzeci** (`schedule_exceptions`) za konkretan datum imaju prednost (isto kao `resolveShift`).
  Slobodan dan: `location_id` i sablon su NULL, vazi u svim objektima. Smena-izuzetak mora imati
  i lokaciju i sablon.
- Promena rasporeda ne otkazuje postojece termine; novi termini se racunaju po novom rasporedu.
