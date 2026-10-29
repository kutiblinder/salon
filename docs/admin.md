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
- Logo, favicon i galerija nisu ovde: treba object storage (S3/R2), korak posle cena.

## Sledece (isti korak 5)

- Cenovnik: `services` + `location_services` (cena, trajanje, buffer po objektu).
- Galerija: `media` + `gallery_items`, kad bude skladiste slika.
