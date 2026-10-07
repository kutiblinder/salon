/**
 * Primenjuje SQL migracije iz db/migrations (po imenu fajla, redom) i belezi ih u schema_migrations.
 * Pokretanje: npm run db:migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL nije podesen. Kopiraj .env.example u .env.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    const appliedRes = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.name));

    // Sema je mozda vec napravljena na stari nacin (docker initdb) bez evidencije: ne primenjuj 001 dvaput.
    if (applied.size === 0 && files.includes('001_init.sql')) {
      const exists = await client.query<{ t: string | null }>(`SELECT to_regclass('public.organizations') AS t`);
      if (exists.rows[0].t) {
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['001_init.sql']);
        applied.add('001_init.sql');
        console.log('Postojeca sema pronadjena: 001_init.sql oznacen kao primenjen.');
      }
    }

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`Primenjujem ${file} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Greska u ${file}:`, error instanceof Error ? error.message : error);
        process.exit(1);
      }
      count++;
    }
    console.log(count === 0 ? 'Baza je azurna.' : `Primenjeno migracija: ${count}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
