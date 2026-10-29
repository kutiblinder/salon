/**
 * Probni nalozi za razvoj. Lozinke su namerno jednostavne (samo lokalno).
 * Pokreće se iz `npm run db:seed`. Spisak: docs/dev-nalozi.md
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';

const DEMO = '11111111-1111-4111-8111-111111111111';
const SAJT2 = '11111111-1111-4111-8111-111111111112';
const SAJT3 = '11111111-1111-4111-8111-111111111113';
const MARKO = '44444444-4444-4444-8444-444444444441';
const ANA = '44444444-4444-4444-8444-444444444443';
const IVANA = '44444444-4444-4444-8444-444444444444';

interface SeedUser {
  email: string;
  name: string;
  password: string;
  organizationId: string | null;
  role: 'admin' | 'owner' | 'staff';
  staffId?: string;
}

const USERS: SeedUser[] = [
  { email: 'admin@admin.rs', name: 'Admin', password: 'admin', organizationId: null, role: 'admin' },
  { email: 'vlasnik@localhost.rs', name: 'Vlasnik Demo', password: 'vlasnik', organizationId: DEMO, role: 'owner' },
  {
    email: 'zaposleni@localhost.rs',
    name: 'Marko',
    password: 'zaposleni',
    organizationId: DEMO,
    role: 'staff',
    staffId: MARKO,
  },
  { email: 'vlasnik@sajt2.rs', name: 'Vlasnik Dva', password: 'vlasnik', organizationId: SAJT2, role: 'owner' },
  {
    email: 'zaposleni@sajt2.rs',
    name: 'Ana',
    password: 'zaposleni',
    organizationId: SAJT2,
    role: 'staff',
    staffId: ANA,
  },
  { email: 'vlasnik@sajt3.rs', name: 'Vlasnik Tri', password: 'vlasnik', organizationId: SAJT3, role: 'owner' },
  {
    email: 'zaposleni@sajt3.rs',
    name: 'Ivana',
    password: 'zaposleni',
    organizationId: SAJT3,
    role: 'staff',
    staffId: IVANA,
  },
];

async function upsertUser(client: pg.Client, u: SeedUser): Promise<void> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id IS NOT DISTINCT FROM $2',
    [u.email, u.organizationId],
  );
  const userId = existing.rows[0]?.id ?? randomUUID();
  const hash = await hashPassword(u.password);

  if (!existing.rows[0]) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, full_name, email_verified, privacy_consent_at)
       VALUES ($1, $2, $3, $4, true, now())`,
      [userId, u.organizationId, u.email, u.name],
    );
    await client.query(
      `INSERT INTO accounts (id, account_id, provider_id, user_id, organization_id, password)
       VALUES ($1, $2::text, 'credential', $2::uuid, $3, $4)`,
      [randomUUID(), userId, u.organizationId, hash],
    );
  } else {
    await client.query(`UPDATE users SET full_name = $2, email_verified = true WHERE id = $1`, [userId, u.name]);
    await client.query(
      `UPDATE accounts SET password = $2 WHERE user_id = $1 AND provider_id = 'credential'`,
      [userId, hash],
    );
  }

  const scope = u.role === 'admin' ? 'platform' : 'organization';
  await client.query(
    `INSERT INTO memberships (user_id, role, scope, organization_id, location_id)
     VALUES ($1, $2, $3, $4, NULL) ON CONFLICT DO NOTHING`,
    [userId, u.role, scope, u.organizationId],
  );

  if (u.staffId) {
    const linked = await client.query(
      `UPDATE staff SET user_id = $1 WHERE id = $2 AND organization_id = $3`,
      [userId, u.staffId, u.organizationId],
    );
    if (!linked.rowCount) throw new Error(`Profil zaposlenog ${u.staffId} ne postoji`);
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL nije podesen.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const u of USERS) await upsertUser(client, u);
    await client.query('COMMIT');
    console.log(`Nalozi (${USERS.length}): vidi docs/dev-nalozi.md`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
