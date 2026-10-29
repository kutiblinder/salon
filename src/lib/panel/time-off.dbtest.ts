/**
 * Panel odsustva nad pravom bazom: dozvole, audit, upis tstzrange.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { addDays, localDateOf, zonedTimeToUtcMs } from '../availability/time';
import { loadPanelContext, PanelError, type PanelContext, type SalonSession } from './core';
import { breakRange, createTimeOff, deleteTimeOff, fullDayRange } from './time-off';

const TZ = 'Europe/Belgrade';
const ORG = testId();
const LOC = testId();
const ANA = testId();
const BOJAN = testId();
const OWNER_USER = testId();
const ANA_USER = testId();
const FROM = addDays(localDateOf(Date.now(), TZ), 14);

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG}', 'Time off test', 'toff-${ORG.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name) VALUES ('${LOC}', '${ORG}', 'A');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${OWNER_USER}', '${ORG}', 'vlasnik@test.rs', 'Vlasnik'), ('${ANA_USER}', '${ORG}', 'ana@test.rs', 'Ana');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${OWNER_USER}', 'owner', 'organization', '${ORG}'), ('${ANA_USER}', 'staff', 'organization', '${ORG}');
    INSERT INTO staff (id, organization_id, display_name, user_id) VALUES
      ('${ANA}', '${ORG}', 'Ana', '${ANA_USER}'), ('${BOJAN}', '${ORG}', 'Bojan', NULL);
    INSERT INTO staff_locations (staff_id, location_id) VALUES ('${ANA}', '${LOC}'), ('${BOJAN}', '${LOC}');`);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id = $1', [ORG]);
  await getPool().end();
});

function session(userId: string): SalonSession {
  return {
    realm: {
      kind: 'salon',
      organizationId: ORG,
      tenant: { id: ORG, name: 'Time off test', slug: 'toff', status: 'published', theme: {} },
    },
    user: { id: userId, name: 'u', email: 'u@test.rs', phone: null, organizationId: ORG },
    sessionId: testId(),
    activeOrganizationId: null,
  };
}

function asUser<T>(userId: string, fn: (client: PoolClient, ctx: PanelContext) => Promise<T>) {
  return withTenant(ORG, async (client) => fn(client, await loadPanelContext(client, session(userId))));
}

test('vlasnik unosi godisnji; interval je [ponoc, ponoc), uz audit', async () => {
  const range = fullDayRange(FROM, addDays(FROM, 2), TZ);
  assert.ok(range);
  const created = await asUser(OWNER_USER, (client, ctx) =>
    createTimeOff(client, ctx, {
      staffId: BOJAN,
      kind: 'vacation',
      startMs: range.startMs,
      endMs: range.endMs,
      note: 'more',
    }),
  );
  const row = await getPool().query(
    `SELECT kind, note, lower(during) AS s, upper(during) AS e FROM time_off WHERE id = $1`,
    [created.id],
  );
  assert.equal(row.rows[0].kind, 'vacation');
  assert.equal(row.rows[0].note, 'more');
  assert.equal(row.rows[0].s.toISOString(), new Date(range.startMs).toISOString());
  assert.equal(row.rows[0].e.toISOString(), new Date(range.endMs).toISOString());
  const audit = await getPool().query(
    `SELECT action FROM audit_log WHERE object_id = $1 AND object_type = 'time_off'`,
    [created.id],
  );
  assert.deepEqual(audit.rows.map((r) => r.action), ['schedule.time_off.create']);
});

test('zaposleni unosi samo svoju pauzu, ne tudje odsustvo', async () => {
  const range = breakRange(FROM, '12:00', '13:00', TZ);
  assert.ok(range);
  await asUser(ANA_USER, (client, ctx) =>
    createTimeOff(client, ctx, { staffId: ANA, kind: 'break', startMs: range.startMs, endMs: range.endMs, note: null }),
  );
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) =>
      createTimeOff(client, ctx, {
        staffId: BOJAN,
        kind: 'sick',
        startMs: zonedTimeToUtcMs(FROM, '00:00', TZ),
        endMs: zonedTimeToUtcMs(addDays(FROM, 1), '00:00', TZ),
        note: null,
      }),
    ),
    PanelError,
  );
});

test('zaposleni ne moze da obrise tudje; vlasnik brise uz audit', async () => {
  const range = fullDayRange(addDays(FROM, 10), addDays(FROM, 10), TZ);
  assert.ok(range);
  const created = await asUser(OWNER_USER, (client, ctx) =>
    createTimeOff(client, ctx, {
      staffId: BOJAN,
      kind: 'sick',
      startMs: range.startMs,
      endMs: range.endMs,
      note: null,
    }),
  );
  await assert.rejects(asUser(ANA_USER, (client, ctx) => deleteTimeOff(client, ctx, created.id)), PanelError);
  await asUser(OWNER_USER, (client, ctx) => deleteTimeOff(client, ctx, created.id));
  const gone = await getPool().query(`SELECT 1 FROM time_off WHERE id = $1`, [created.id]);
  assert.equal(gone.rowCount, 0);
  const audit = await getPool().query(
    `SELECT action FROM audit_log WHERE object_id = $1 AND object_type = 'time_off' ORDER BY id`,
    [created.id],
  );
  assert.deepEqual(
    audit.rows.map((r) => r.action),
    ['schedule.time_off.create', 'schedule.time_off.delete'],
  );
});
