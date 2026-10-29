/**
 * Pravi nalog sa lozinkom i ulogom (javne registracije za ove naloge nema).
 *
 *   npm run user:create '--' --platform-admin --email ti@primer.rs --name "Ime Prezime"
 *   npm run user:create '--' --org demo --role owner --email vlasnik@primer.rs --name "Vlasnik"
 *   npm run user:create '--' --org demo --role staff --email marko@primer.rs --name "Marko" --staff <staff-id>
 *   npm run user:create '--' --org demo --role manager --location <location-id> --email ... --name ...
 *
 * '--' je pod navodnicima zbog PowerShell-a (inace ga proguta pre npm-a); u bash-u moze i bez.
 * Ako nalog vec postoji u tom prostoru, samo se dodaje uloga. Lozinka se generise i ispise
 * jednom (ili --password ...); korisnik je menja posle prijave.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';

const ROLES = ['owner', 'manager', 'staff'] as const;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'platform-admin': { type: 'boolean', default: false },
      org: { type: 'string' },
      role: { type: 'string' },
      location: { type: 'string' },
      staff: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  if (!email || !name) fail('Obavezno: --email i --name');
  const platformAdmin = values['platform-admin'] === true;
  if (platformAdmin === Boolean(values.org)) fail('Navedi tacno jedno: --platform-admin ili --org <slug>');
  const role = platformAdmin ? 'admin' : values.role;
  if (!platformAdmin && !ROLES.includes(role as (typeof ROLES)[number])) fail(`--role mora biti: ${ROLES.join(', ')}`);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');

    let organizationId: string | null = null;
    if (values.org) {
      const org = await client.query<{ id: string }>('SELECT id FROM organizations WHERE slug = $1', [values.org]);
      if (!org.rows[0]) fail(`Salon "${values.org}" ne postoji`);
      organizationId = org.rows[0].id;
    }

    let password: string | null = null;
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 AND organization_id IS NOT DISTINCT FROM $2',
      [email, organizationId],
    );
    let userId = existing.rows[0]?.id;
    if (!userId) {
      password = values.password ?? randomBytes(12).toString('base64url');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (organization_id, email, full_name, email_verified) VALUES ($1, $2, $3, true) RETURNING id`,
        [organizationId, email, name],
      );
      userId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO accounts (account_id, provider_id, user_id, organization_id, password)
         VALUES ($1::text, 'credential', $1::bigint, $2, $3)`,
        [userId, organizationId, await hashPassword(password)],
      );
    }

    const scope = platformAdmin ? 'platform' : values.location ? 'location' : 'organization';
    await client.query(
      `INSERT INTO memberships (user_id, role, scope, organization_id, location_id)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [userId, role, scope, organizationId, values.location ?? null],
    );

    if (values.staff) {
      const linked = await client.query(
        `UPDATE staff SET user_id = $1 WHERE id = $2 AND organization_id = $3`,
        [userId, values.staff, organizationId],
      );
      if (!linked.rowCount) fail(`Profil zaposlenog ${values.staff} ne postoji u ovom salonu`);
    }

    await client.query(
      `INSERT INTO audit_log (organization_id, user_id, action, object_type, object_id, new_value)
       VALUES ($1, NULL, 'user.create', 'membership', $2, $3)`,
      [organizationId, userId, JSON.stringify({ email, role, scope, location: values.location ?? null, by: 'script' })],
    );
    await client.query('COMMIT');

    const where = platformAdmin ? 'platforma' : `salon ${values.org}`;
    console.log(`Nalog ${email} (${where}), uloga: ${role}${values.location ? ` na lokaciji ${values.location}` : ''}.`);
    if (password) console.log(`Lozinka (sacuvaj je, vise se ne prikazuje): ${password}`);
    else console.log('Nalog je vec postojao: dodata je samo uloga, lozinka nije menjana.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
