/**
 * Izvrsava jedan SQL fajl nad bazom. Pokretanje: npm run db:seed
 * (ili: node --env-file=.env --import tsx scripts/run-sql.ts putanja/do/fajla.sql)
 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';

async function main(): Promise<void> {
  const file = process.argv[2];
  const connectionString = process.env.DATABASE_URL;
  if (!file) {
    console.error('Upotreba: run-sql.ts <fajl.sql>');
    process.exit(1);
  }
  if (!connectionString) {
    console.error('DATABASE_URL nije podesen. Kopiraj .env.example u .env.');
    process.exit(1);
  }
  const sql = await readFile(file, 'utf8');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Izvrseno: ${file}`);
  } catch (error) {
    console.error('Greska:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
