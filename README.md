# Salon platforma

Platforma za zakazivanje termina u frizerskim salonima, salonima za masažu, manikir i pedikir.
Next.js (TypeScript) + PostgreSQL. Svaki salon ima svoj sajt na subdomenu (kasnije i na svom domenu).

Detaljne odluke i plan su u [`CLAUDE.md`](CLAUDE.md).

## Potrebni alati

| Alat | Čemu služi |
|---|---|
| Git | verzije koda |
| Docker Desktop (Windows) / Docker Engine (Linux) | pokreće PostgreSQL |
| Node.js 22 ili noviji (LTS) | aplikacija |
| Editor (npr. VS Code) | uređivanje |

### Windows (PowerShell)

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
winget install Microsoft.VisualStudioCode
```

Docker Desktop traži WSL2: u PowerShell-u **kao administrator** `wsl --install`, pa restart.
Zatim pokreni Docker Desktop i sačekaj da prestane da piše *starting*.
Posle instalacije zatvori i ponovo otvori PowerShell, pa proveri:

```powershell
git --version
node --version      # v22 ili novije
npm --version
docker --version
docker compose version
```

Ako Docker prijavi da disk `E:` nije podeljen: *Settings → Resources → File sharing* → dodaj `E:\`.

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Node.js 22 LTS (npr. preko nvm):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# otvori novi terminal, pa:
nvm install 22
```

Odjavi se i prijavi (zbog grupe `docker`), pa proveri iste komande kao gore.

## Git (jednom po mašini)

```bash
git config --global user.name 'Ime Prezime'
git config --global user.email 'tvoj@email.com'
git config --global init.defaultBranch main
```

## Pokretanje projekta

Sve komande iz foldera projekta (`E:\salon` na Windowsu, npr. `~/salon` na Linuxu).

**1. Podešavanje (jednom):**

```powershell
# Windows PowerShell
cd E:\salon
Copy-Item .env.example .env
npm install
```

```bash
# Linux
cd ~/salon
cp .env.example .env
npm install
```

U `.env` promeni `POSTGRES_PASSWORD` i **istu lozinku upiši i u `DATABASE_URL`**. Fajl `.env` se ne commit-uje.

**2. Baza:**

```bash
docker compose up -d
docker compose ps          # u koloni statusa mora da piše: healthy
npm run db:migrate         # pravi tabele
npm run db:seed            # probni salon "demo" sa radnicima i uslugama (opciono)
npm run user:create '--' --platform-admin --email ti@primer.rs --name "Ime Prezime"   # tvoj admin nalog
npm run user:create '--' --org demo --role owner --email vlasnik@primer.rs --name "Vlasnik"   # vlasnik demo salona
```

Skripta ispiše generisanu lozinku. `'--'` je pod navodnicima zbog PowerShell-a (u bash-u može i bez).
Više u [`docs/autentifikacija.md`](docs/autentifikacija.md).

**3. Aplikacija:**

```bash
npm run dev
```

Otvori:

- http://ateljekosic.rs:3000 — Atelje Kosić (`npm run hosts:dev`; radi i atelje.localhost:3000);
  `/prijava`, `/registracija`, `/nalog`, `/panel`
- http://zenmasaza.rs:3000 — Zen Masaža; http://bellanails.rs:3000 — Bella Nails
- http://localhost:3000/admin — admin platforme (domen platforme; nalog iz `user:create --platform-admin`)
- http://localhost:3000/api/health — treba `{"status":"ok","db":"up"}`
- Slobodni termini (Fade šišanje, bilo koji radnik; zameni datum budućim radnim danom):
  http://ateljekosic.rs:3000/api/availability?locationId=1&serviceId=1&date=2026-11-02

Ako je datum u prošlosti ili dalje od 90 dana, lista termina je prazna (ponedeljak–subota ima termine, nedelja nema).

Zakazivanje gosta i link za otkazivanje: vidi [`docs/zakazivanje.md`](docs/zakazivanje.md).

## Komande

| Komanda | Šta radi |
|---|---|
| `npm run dev` | razvojni server |
| `npm test` | jedinični testovi (algoritam termina, prepoznavanje salona, validacija), ne traže bazu |
| `npm run test:db` | integracioni testovi zakazivanja nad bazom (pravi i briše svoje probne salone) |
| `npm run typecheck` | provera TypeScript tipova |
| `npm run db:migrate` | primeni nove SQL migracije iz `db/migrations` |
| `npm run db:seed` | ubaci probne podatke (`db/seed/dev_seed.sql`) |
| `npm run jobs:expire-pending` | otkaži stare `pending` gost-termine kojima je istekao rok (u produkciji cron) |
| `npm run user:create '--' ...` | napravi nalog admina platforme, vlasnika, menadžera ili zaposlenog |
| `docker compose stop` | zaustavi bazu (podaci ostaju) |
| `docker compose down -v` | obriši bazu i podatke (čist početak), posle toga ponovo `up -d` i `db:migrate` |

**Migracije:** svaka izmena šeme ide u **novi fajl** (`db/migrations/002_opis.sql`), nikad izmena već primenjenog fajla. Dok nemaš prave podatke, najlakše je `docker compose down -v` pa ponovo migracije.

## Struktura

```
salon/
├── db/
│   ├── migrations/                 šema baze (001_init.sql, 002_...)
│   └── seed/dev_seed.sql           probni podaci
├── scripts/                        migrate.ts, run-sql.ts, expire-pending.ts, create-user.ts
├── src/
│   ├── app/                        Next.js stranice i API rute
│   └── lib/
│       ├── availability/           algoritam slobodnih termina (+ testovi)
│       ├── appointments/           zakazivanje, otkazivanje tokenom, istek pending redova
│       ├── auth/                   Better Auth, nalozi po salonu, can() dozvole
│       ├── audit.ts                audit log
│       ├── notify.ts               obaveštenja (za sada samo log u razvoju)
│       ├── db.ts                   konekcija na PostgreSQL, withTenant()
│       ├── tenant.ts, tenant-key.ts   prepoznavanje salona iz domena
├── docs/
├── docker-compose.yml, .env.example, CLAUDE.md, README.md
```

## Git: svakodnevni rad

```bash
git switch -c feature/naziv-funkcije
git add .
git status                 # .env NE sme da bude na listi
git commit -m 'Opis promene'
git push -u origin feature/naziv-funkcije
```

Nikad u Git: `.env`, privatni ključevi, dump baze sa pravim podacima klijenata.
Posle prvog `npm install` commit-uj i `package-lock.json`.

## Česti problemi

- **`docker` ne radi:** pokreni Docker Desktop; proveri da su virtualizacija i WSL2 uključeni.
- **Port 5432 zauzet:** u `.env` stavi `POSTGRES_PORT=5433` i isti port u `DATABASE_URL`.
- **`db:migrate` kaže da `.env` ne postoji / DATABASE_URL nije podešen:** napravi `.env` iz `.env.example`.
- **`password authentication failed`:** lozinka u `DATABASE_URL` ne odgovara `POSTGRES_PASSWORD`. Ako si menjao lozinku posle prvog pokretanja baze: `docker compose down -v`, pa ponovo.
- **Salon na `.rs` domenu ne otvara stranu:** pokreni `npm run hosts:dev` kao Administrator. `*.localhost` (npr. `atelje.localhost`) radi u Chrome/Edge/Firefox bez hosts fajla. Goli `http://localhost:3000` je domen platforme, ne salona.
- **`npm install` visi ili javlja `unable to verify the first certificate`:** antivirus (npr. AVG/Avast) skenira HTTPS svojim sertifikatom, kome Node ne veruje. Izvezi taj sertifikat i reci Node-u da mu veruje (jednom, PowerShell):
  ```powershell
  $c = Get-ChildItem Cert:\LocalMachine\Root | Where-Object Subject -match 'AVG|Avast' | Select-Object -First 1
  New-Item -ItemType Directory -Force "$env:USERPROFILE\.certs" | Out-Null
  "-----BEGIN CERTIFICATE-----`n$([Convert]::ToBase64String($c.RawData, 'InsertLineBreaks'))`n-----END CERTIFICATE-----" | Set-Content -Encoding ascii "$env:USERPROFILE\.certs\avg-root.pem"
  [Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS', "$env:USERPROFILE\.certs\avg-root.pem", 'User')
  ```
  Zatim zatvori i ponovo otvori terminal (i Cursor). Proveru sertifikata ne isključuj (`strict-ssl false`).
- **Greške tipa `bad interpreter` ili `\r`:** fajl ima Windows završetke redova; `git add --renormalize .`
- **Linux: `permission denied` za Docker:** odjavi se i prijavi posle `usermod`.
