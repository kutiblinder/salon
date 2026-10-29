# Deploy na Hetzner (Docker Compose + Caddy)

Isti stack kao lokalno: Postgres 16, Next.js (`output: 'standalone'`), Caddy za HTTPS.

## Šta treba na VPS-u

- Docker i Docker Compose
- Domen platforme (npr. `tvojsajt.rs`) i DNS `*.tvojsajt.rs` -> IP servera
- Fajl `.env` (nije u gitu): `POSTGRES_*`, `DATABASE_URL` (unutra u mreži: `postgres://salon:...@db:5432/salon`),
  `BASE_DOMAIN=tvojsajt.rs`, `BETTER_AUTH_SECRET`, `CADDY_EMAIL`, `CRON_SECRET`,
  opciono `RESEND_API_KEY`, `EMAIL_FROM`, `STORAGE_DIR=/data/media`

## Pokretanje

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# migracije idu automatski (servis migrate) pre starta aplikacije
```

Caddy automatski izdaje sertifikate. Slike galerije su na volume-u `media`.

## Custom domen salona

1. DNS A/AAAA (i CNAME www) na IP servera.
2. U adminu `/admin/domeni` dodaj domen i označi ga kao proveren (ili `verified_at = now()` u bazi).
3. Caddy `on_demand` TLS pita `GET /api/tls-ask?domain=` (vidi `deploy/Caddyfile`).

## Cron

Kontejner `expire` svakih 60s zove `POST /api/jobs/expire-pending` sa `Authorization: Bearer $CRON_SECRET`.

## Produkcijska uloga baze

Lokalni `salon` korisnik je superuser pa RLS ne filtrira. Na VPS-u, posle migracija:

```
psql "$DATABASE_URL" -f db/prod/app_role.sql
```

Zameni lozinku u tom fajlu pre pokretanja. `DATABASE_URL` **aplikacije** (servis `app`) stavi na
`postgres://salon_app:...@db:5432/salon`. Migracije ostaju na vlasniku.
