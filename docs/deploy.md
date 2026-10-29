# Deploy na Hetzner (Docker Compose + Caddy)

Isti stack kao lokalno: Postgres 16, Next.js (`output: 'standalone'`), Caddy za HTTPS.

## Šta treba na VPS-u

- Docker i Docker Compose
- Domen platforme (npr. `tvojsajt.rs`) i DNS `*.tvojsajt.rs` -> IP servera
- Fajl `.env` (nije u gitu): `POSTGRES_*`, `DATABASE_URL` (unutra u mreži: `postgres://salon:...@db:5432/salon`),
  `BASE_DOMAIN=tvojsajt.rs`, `BETTER_AUTH_SECRET`, opciono `RESEND_API_KEY`, `EMAIL_FROM`, `STORAGE_DIR=/data/media`

## Pokretanje

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# migracije idu automatski (servis migrate) pre starta aplikacije
```

Caddy automatski izdaje sertifikate. Slike galerije su na volume-u `media`.

## Custom domen salona

1. DNS A/AAAA (i CNAME www) na IP servera.
2. Upis u `organization_domains` (`verified_at = now()` kad je DNS spreman).
3. Caddy `on_demand` TLS (vidi `deploy/Caddyfile`).

## Cron

Kontejner `expire` svaki minut pokreće `npm run jobs:expire-pending`.

## Produkcijska uloga baze

Lokalni `salon` korisnik je superuser pa RLS ne filtrira. Na VPS-u napravi ulogu koja nije vlasnik
tabela i `GRANT` samo `SELECT/INSERT/UPDATE/DELETE`; RLS onda drži tenant.
