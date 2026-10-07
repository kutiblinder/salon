# Kako nastaviti rad (ručno ili sa Claude Code-om)

## Ručno, iz ovog repozitorijuma

Prati odeljak "Pokretanje projekta" u `README.md` (instalacija, `npm install`, baza, migracije, `npm run dev`).

## Sa Claude Code-om (plaćen plan ili API ključ)

1. Pokreni Docker Desktop.
2. U PowerShell-u:
   ```
   cd E:\salon
   claude
   ```
   (ili u Claude Desktop aplikaciji kartica **Code**, folder `E:\salon`)
3. Prva poruka:

   > Pročitaj CLAUDE.md, posebno odeljak "Trenutno stanje". Pokreni `npm install`, bazu, migracije
   > i seed, pa `npm test` i `npm run typecheck`. Ispravi sve što ne radi (deo koda nije
   > testiran na pravoj bazi), proveri `/api/availability` i `/api/health`, pa ažuriraj CLAUDE.md.
   > Posle toga nastavi sa korakom 3 iz "Redosled gradnje": POST /api/appointments.

4. Posle svakog većeg koraka neka Claude Code ažurira odeljak "Trenutno stanje" u `CLAUDE.md`.
