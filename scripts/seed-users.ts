/**
 * Probni nalozi za razvoj. Lozinke su namerno jednostavne (samo lokalno).
 * Pokreće se iz `npm run db:seed`. Spisak: docs/dev-nalozi.md
 */
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';

const DEMO = '1';
const SAJT2 = '2';
const SAJT3 = '3';
const MARKO = '1';
const JOVANA = '2';
const ANA = '3';
const IVANA = '4';
const NEMANJA = '5';
const MILICA = '6';

interface SeedUser {
  email: string;
  name: string;
  password: string;
  organizationId: string | null;
  role?: 'admin' | 'owner' | 'staff';
  staffId?: string;
  phone?: string;
}

const USERS: SeedUser[] = [
  { email: 'admin@admin.rs', name: 'Admin', password: 'admin', organizationId: null, role: 'admin' },
  { email: 'vlasnik@ateljekosic.rs', name: 'Milan Kosić', password: 'vlasnik', organizationId: DEMO, role: 'owner' },
  {
    email: 'zaposleni@ateljekosic.rs',
    name: 'Marko Kosić',
    password: 'zaposleni',
    organizationId: DEMO,
    role: 'staff',
    staffId: MARKO,
  },
  {
    email: 'jovana@ateljekosic.rs',
    name: 'Jovana Kosić',
    password: 'zaposleni',
    organizationId: DEMO,
    role: 'staff',
    staffId: JOVANA,
  },
  {
    email: 'musterija@ateljekosic.rs',
    name: 'Petar Petrović',
    password: 'musterija',
    organizationId: DEMO,
    phone: '+381641111111',
  },
  { email: 'vlasnik@zenmasaza.rs', name: 'Jelena Simić', password: 'vlasnik', organizationId: SAJT2, role: 'owner' },
  {
    email: 'zaposleni@zenmasaza.rs',
    name: 'Ana Simić',
    password: 'zaposleni',
    organizationId: SAJT2,
    role: 'staff',
    staffId: ANA,
  },
  {
    email: 'nemanja@zenmasaza.rs',
    name: 'Nemanja Ilić',
    password: 'zaposleni',
    organizationId: SAJT2,
    role: 'staff',
    staffId: NEMANJA,
  },
  {
    email: 'musterija@zenmasaza.rs',
    name: 'Mila Jovanović',
    password: 'musterija',
    organizationId: SAJT2,
    phone: '+381642222222',
  },
  { email: 'vlasnik@bellanails.rs', name: 'Bella Petrović', password: 'vlasnik', organizationId: SAJT3, role: 'owner' },
  {
    email: 'zaposleni@bellanails.rs',
    name: 'Ivana Petrović',
    password: 'zaposleni',
    organizationId: SAJT3,
    role: 'staff',
    staffId: IVANA,
  },
  {
    email: 'milica@bellanails.rs',
    name: 'Milica Jovanović',
    password: 'zaposleni',
    organizationId: SAJT3,
    role: 'staff',
    staffId: MILICA,
  },
  {
    email: 'musterija@bellanails.rs',
    name: 'Nikola Ilić',
    password: 'musterija',
    organizationId: SAJT3,
    phone: '+381643333333',
  },
];

async function upsertUser(client: pg.Client, u: SeedUser): Promise<void> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id IS NOT DISTINCT FROM $2',
    [u.email, u.organizationId],
  );
  const hash = await hashPassword(u.password);
  let userId = existing.rows[0]?.id;

  if (!userId) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (organization_id, email, full_name, phone, email_verified, privacy_consent_at)
       VALUES ($1, $2, $3, $4, true, now()) RETURNING id`,
      [u.organizationId, u.email, u.name, u.phone ?? null],
    );
    userId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO accounts (account_id, provider_id, user_id, organization_id, password)
       VALUES ($1::text, 'credential', $1::bigint, $2, $3)`,
      [userId, u.organizationId, hash],
    );
  } else {
    await client.query(`UPDATE users SET full_name = $2, phone = $3, email_verified = true WHERE id = $1`, [
      userId,
      u.name,
      u.phone ?? null,
    ]);
    await client.query(
      `UPDATE accounts SET password = $2 WHERE user_id = $1 AND provider_id = 'credential'`,
      [userId, hash],
    );
  }

  if (u.role) {
    const scope = u.role === 'admin' ? 'platform' : 'organization';
    await client.query(
      `INSERT INTO memberships (user_id, role, scope, organization_id, location_id)
       VALUES ($1, $2, $3, $4, NULL) ON CONFLICT DO NOTHING`,
      [userId, u.role, scope, u.organizationId],
    );
  }

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
