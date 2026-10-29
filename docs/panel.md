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
- Logika panela bez Next-a je u `src/lib/panel/` (`core.ts`, `appointments.ts`, `schedule.ts`,
  `time-off.ts`, `staff.ts`; testovi: `*.dbtest.ts`).

## Termini (`/panel/termini`)

- Dnevni prikaz po lokaciji, kolone po radniku (na telefonu jedna ispod druge).
  Zaposleni vidi samo svoje. Vlasnik/menadžer vidi kod koga je termin i može da filtrira
  po zaposlenom (`?radnik=`). Prijava zaposlenog/vlasnika ide na `/panel` → termini.
- Prelazi statusa (`src/lib/appointments/status.ts`):
  - `pending -> confirmed` (dugme „Potvrdi rezervaciju“, samo za stare `pending` redove; novi gosti su odmah potvrđeni);
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

## Odsustva (`/panel/odsustva`)

- Tabela `time_off` (nema lokacije): pauza, godisnji, bolovanje, drugo. Oduzima se od smene u
  `computeSlots` (usluga ne sme da se preklapa sa odsustvom).
- Pauza: jedan dan, pocetak i kraj u istom danu (MVP, kao smene, ne preko ponoci).
- Godisnji/bolovanje: celi dani, oba datuma ukljucena, u vremenskoj zoni objekta (`[ponoc, ponoc)`).
  Vazi na svim objektima tog radnika.
- Zaposleni sa `own_only` vidi i menja samo svoja odsustva. Menadzer vezan za lokaciju: radnike
  koji rade na toj lokaciji (odsustvo i dalje vazi i na drugim objektima).
- Unos ne otkazuje postojece termine.

## Zaposleni (`/panel/zaposleni`)

- Profil (`staff`): ime, titula, opis, redosled, aktivan. Izmena imena menja i ime naloga.
  Slika (`photo_url`) nije u ovom koraku.
  Bar jedna lokacija. Usluge opcione; prazno trajanje = trajanje sa `location_services`.
- Menja nalog sa `staff.manage` (vlasnik, ili admin platforme u salonu). Menadzer i zaposleni
  nemaju ovu dozvolu.
- Skidanje lokacije brise `weekly_schedule` i `schedule_exceptions` vezane za tu lokaciju
  (slobodan dan bez lokacije ostaje).
- Deaktivacija (`is_active = false`): ne vidi se za zakazivanje, profil ostaje, ne može da se
  prijavi (sesije se brišu). Brisanje na detalju: odbija se ako ima buduće termine; profil i
  nalog za prijavu se uklanjaju. Admin platforme isto sa `/admin/zaposleni`.
- **Nalog za prijavu**: ako email vec postoji u tom salonu, veze se (dodaje se `staff`
  clanstvo, `staff.user_id`); inace se pravi `users` + `accounts` kao `user:create`.
  Lozinka se prikaze jednom, nikad ne ide u audit log. Isti nalog ne moze na dva profila
  (`staff_user_idx`).
