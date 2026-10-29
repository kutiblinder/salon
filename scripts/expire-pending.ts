/**
 * Pozadinski posao: stare pending gost-termine sa isteklim rokom prebacuje u otkazane.
 * Pokretanje: npm run jobs:expire-pending (u produkciji cron, npr. svaki minut).
 * Mora da radi ulogom koja zaobilazi RLS (vlasnik tabela), jer obradjuje sve salone.
 */
import pg from 'pg';
import { expirePendingAppointments } from '../src/lib/appointments/expire';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL nije podesen. Kopiraj .env.example u .env.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const count = await expirePendingAppointments(client, null);
    console.log(`Isteklih termina otkazano: ${count}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
