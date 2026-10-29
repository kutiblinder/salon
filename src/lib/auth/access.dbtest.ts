/**
 * Prijava: neaktivan salon i neaktivan zaposleni.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import { getPool } from '../db';
import { loginDeniedReason } from './access';

const ORG = testId();
const OWNER = testId();
const STAFF_USER = testId();
const STAFF = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug, status) VALUES ('${ORG}', 'Access', 'ac-${ORG.slice(0, 8)}', 'published');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${OWNER}', '${ORG}', 'owner-acc@test.rs', 'Vlasnik'),
      ('${STAFF_USER}', '${ORG}', 'radnik-acc@test.rs', 'Radnik');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${OWNER}', 'owner', 'organization', '${ORG}'),
      ('${STAFF_USER}', 'staff', 'organization', '${ORG}');
    INSERT INTO staff (id, organization_id, display_name, user_id, is_active)
      VALUES ('${STAFF}', '${ORG}', 'Radnik', '${STAFF_USER}', true);
  `);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id = $1', [ORG]);
  await getPool().end();
});

test('objavljen salon i aktivan zaposleni smeju da se prijave', async () => {
  const client = await getPool().connect();
  try {
    assert.equal(await loginDeniedReason(client, { organizationId: ORG, userId: STAFF_USER }), null);
    assert.equal(await loginDeniedReason(client, { organizationId: ORG, email: 'radnik-acc@test.rs' }), null);
  } finally {
    client.release();
  }
});

test('neaktivan zaposleni ne sme, vlasnik sme', async () => {
  await getPool().query(`UPDATE staff SET is_active = false WHERE id = $1`, [STAFF]);
  const client = await getPool().connect();
  try {
    assert.match(
      (await loginDeniedReason(client, { organizationId: ORG, userId: STAFF_USER })) ?? '',
      /deaktiviran/,
    );
    assert.equal(await loginDeniedReason(client, { organizationId: ORG, userId: OWNER }), null);
  } finally {
    client.release();
  }
  await getPool().query(`UPDATE staff SET is_active = true WHERE id = $1`, [STAFF]);
});

test('neaktivan salon: niko se ne prijavljuje', async () => {
  await getPool().query(`UPDATE organizations SET status = 'inactive' WHERE id = $1`, [ORG]);
  const client = await getPool().connect();
  try {
    assert.match((await loginDeniedReason(client, { organizationId: ORG, userId: OWNER })) ?? '', /dostupan/);
    assert.match((await loginDeniedReason(client, { organizationId: ORG, email: 'radnik-acc@test.rs' })) ?? '', /dostupan/);
  } finally {
    client.release();
  }
});
