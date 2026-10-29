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

   > Pročitaj CLAUDE.md, posebno odeljak "Trenutno stanje" i "Redosled gradnje". Pokreni bazu
   > i migracije, pa `npm test`, `npm run test:db` i `npm run typecheck`, i nastavi sa sledećim
   > korakom iz "Redosled gradnje".

4. Posle svakog većeg koraka neka Claude Code ažurira odeljak "Trenutno stanje" u `CLAUDE.md`.
