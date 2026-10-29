# Admin panel platforme (korak 5)

Admin je na domenu platforme (`/admin`, lokalno `http://localhost:3000/admin`). Saloni ga ne vide
kao korisnika. Prijava: nalog sa `organization_id` NULL i ulogom `admin` na platformi.

## Ulazak u salon

- Admin eksplicitno bira salon (`POST /api/admin/active-organization`). ID se cuva u
  `sessions.active_organization_id`, **nikad u URL-u ni u telu kasnijih formi**.
- Sve izmene idu kroz `runAdminAction()` (`src/lib/admin/context.ts`): sesija sa ovog domena,
  aktivan salon iz sesije, `withTenant(taj salon)`, `can()` iznova, audit u istoj transakciji.
- Bez izabranog salona nema `content.edit` (vidi `can()`: admin radi samo u salonu u koji je usao).

## Sadrzaj (`/admin/sadrzaj`)

- Dozvola `content.edit` (samo admin, dok vlasniku ne ukljucis prekidac).
- Naziv salona, status sajta (`draft` / `published`), primarna boja (`organizations.theme.primaryColor`).
  Kontrast belog/crnog teksta na toj boji se racuna u `src/lib/admin/theme.ts`.
- Tekstovi: `site_content` kljuc-vrednost. Dozvoljeni kljucevi su u kodu (`CONTENT_FIELDS` u
  `src/lib/admin/content-types.ts`). Svaka izmena polja ide u `site_content_history`.
- Logo i favicon nisu ovde (kasnije, isti mehanizam kao galerija).

## Cenovnik (`/admin/cene`)

- Dozvole `services.edit` (katalog) i `prices.edit` (cena/trajanje/buffer po objektu). Admin ima obe.
- Usluga na nivou salona (`services`); cena, trajanje i pauza po lokaciji (`location_services`), valuta RSD.
- Bar jedan objekat. Skidanje objekta brise red u `location_services` (postojeci termini zadrze snimak cene).
- Deaktivacija umesto brisanja. Kategorije usluga nisu u ovom koraku.

## Galerija (`/admin/galerija`)

- Dozvola `gallery.edit`. Slike se kompresuju u WebP (`sharp`), cuvaju na disku (`STORAGE_DIR`, podrazumevano `data/media`).
  Isti volume na Hetzneru; S3/R2 kad bude nalog (interfejs `src/lib/storage.ts`).
- Kvota: 40 slika, 5 MB original, 80 MB ukupno po salonu. Alt tekst je obavezan.
- Javni URL: `/api/media/<mediaId>` samo na domenu tog salona (ili admin u tom salonu).

## Sledece

- Javni sajt (korak 6) cita iste tekstove, cene i galeriju.
