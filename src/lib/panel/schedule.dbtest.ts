/**
 * Panel smena nad pravom bazom: sabloni, nedeljni raspored, izuzeci, own_only, audit.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { addDays, localDateOf } from '../availability/time';
import { loadPanelContext, PanelError, type PanelContext, type SalonSession } from './core';
import {
  createShiftTemplate,
  deleteException,
  deleteShiftTemplate,
  setWeeklyDay,
  updateShiftTemplate,
  upsertException,
} from './schedule';

const TZ = 'Europe/Belgrade';
const ORG = randomUUID();
const LOC_A = randomUUID();
const LOC_B = randomUUID();
const ANA = randomUUID();
const BOJAN = randomUUID();
const OWNER_USER = randomUUID();
const ANA_USER = randomUUID();
const TPL_A = randomUUID();
const TPL_B = randomUUID();
const DATE = addDays(localDateOf(Date.now(), TZ), 14);

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG}', 'Schedule test', 'sch-${ORG.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name) VALUES
      ('${LOC_A}', '${ORG}', 'A'), ('${LOC_B}', '${ORG}', 'B');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${OWNER_USER}', '${ORG}', 'vlasnik@test.rs', 'Vlasnik'), ('${ANA_USER}', '${ORG}', 'ana@test.rs', 'Ana');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${OWNER_USER}', 'owner', 'organization', '${ORG}'), ('${ANA_USER}', 'staff', 'organization', '${ORG}');
    INSERT INTO staff (id, organization_id, display_name, user_id) VALUES
      ('${ANA}', '${ORG}', 'Ana', '${ANA_USER}'), ('${BOJAN}', '${ORG}', 'Bojan', NULL);
    INSERT INTO staff_locations (staff_id, location_id) VALUES
      ('${ANA}', '${LOC_A}'), ('${ANA}', '${LOC_B}'), ('${BOJAN}', '${LOC_A}');
    INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES
      ('${TPL_A}', '${LOC_A}', 'Prva', '08:00', '15:00'),
      ('${TPL_B}', '${LOC_B}', 'Druga', '12:00', '20:00');`);
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
      tenant: { id: ORG, name: 'Schedule test', slug: 'sch', status: 'published', theme: {} },
    },
    user: { id: userId, name: 'u', email: 'u@test.rs', phone: null, organizationId: ORG },
    sessionId: randomUUID(),
    activeOrganizationId: null,
  };
}

function asUser<T>(userId: string, fn: (client: PoolClient, ctx: PanelContext) => Promise<T>) {
  return withTenant(ORG, async (client) => fn(client, await loadPanelContext(client, session(userId))));
}

test('zaposleni ne moze da pravi ni brise sablone', async () => {
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) =>
      createShiftTemplate(client, ctx, { locationId: LOC_A, name: 'X', start: '09:00', end: '17:00' }),
    ),
    PanelError,
  );
  await assert.rejects(asUser(ANA_USER, (client, ctx) => deleteShiftTemplate(client, ctx, TPL_A)), PanelError);
});

test('vlasnik pravi sablon; brisanje dok se koristi je zabranjeno', async () => {
  const created = await asUser(OWNER_USER, (client, ctx) =>
    createShiftTemplate(client, ctx, { locationId: LOC_A, name: 'Cela', start: '09:00', end: '17:00' }),
  );
  await asUser(OWNER_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: BOJAN, locationId: LOC_A, weekday: 0, templateId: created.id }),
  );
  await assert.rejects(asUser(OWNER_USER, (client, ctx) => deleteShiftTemplate(client, ctx, created.id)), /koristi/);
  await asUser(OWNER_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: BOJAN, locationId: LOC_A, weekday: 0, templateId: null }),
  );
  await asUser(OWNER_USER, (client, ctx) => deleteShiftTemplate(client, ctx, created.id));
  const gone = await getPool().query(`SELECT 1 FROM shift_templates WHERE id = $1`, [created.id]);
  assert.equal(gone.rowCount, 0);
});

test('brisanje smene na lokaciji A ne dira raspored na B; dodela na A prepisuje B', async () => {
  await asUser(OWNER_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: ANA, locationId: LOC_B, weekday: 1, templateId: TPL_B }),
  );
  await asUser(OWNER_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: ANA, locationId: LOC_A, weekday: 1, templateId: null }),
  );
  const stillB = await getPool().query(
    `SELECT location_id FROM weekly_schedule WHERE staff_id = $1 AND weekday = 1`,
    [ANA],
  );
  assert.equal(stillB.rows[0].location_id, LOC_B);

  await asUser(OWNER_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: ANA, locationId: LOC_A, weekday: 1, templateId: TPL_A }),
  );
  const nowA = await getPool().query(
    `SELECT location_id, shift_template_id FROM weekly_schedule WHERE staff_id = $1 AND weekday = 1`,
    [ANA],
  );
  assert.equal(nowA.rows[0].location_id, LOC_A);
  assert.equal(nowA.rows[0].shift_template_id, TPL_A);
});

test('zaposleni menja samo svoj dan, ne tudji', async () => {
  await asUser(OWNER_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: BOJAN, locationId: LOC_A, weekday: 2, templateId: TPL_A }),
  );
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) =>
      setWeeklyDay(client, ctx, { staffId: BOJAN, locationId: LOC_A, weekday: 2, templateId: null }),
    ),
    PanelError,
  );
  await asUser(ANA_USER, (client, ctx) =>
    setWeeklyDay(client, ctx, { staffId: ANA, locationId: LOC_A, weekday: 3, templateId: TPL_A }),
  );
  const row = await getPool().query(
    `SELECT shift_template_id FROM weekly_schedule WHERE staff_id = $1 AND weekday = 3`,
    [ANA],
  );
  assert.equal(row.rows[0].shift_template_id, TPL_A);
});

test('izuzetak: slobodan dan, smena, brisanje; zaposleni ne dira tudji', async () => {
  await asUser(OWNER_USER, (client, ctx) =>
    upsertException(client, ctx, { staffId: BOJAN, date: DATE, kind: 'off', locationId: LOC_A }),
  );
  const off = await getPool().query(
    `SELECT location_id, shift_template_id FROM schedule_exceptions WHERE staff_id = $1 AND work_date = $2::date`,
    [BOJAN, DATE],
  );
  assert.equal(off.rows[0].location_id, null);
  assert.equal(off.rows[0].shift_template_id, null);

  await assert.rejects(
    asUser(ANA_USER, (client, ctx) => deleteException(client, ctx, { staffId: BOJAN, date: DATE, locationId: LOC_A })),
    PanelError,
  );

  await asUser(OWNER_USER, (client, ctx) =>
    upsertException(client, ctx, { staffId: BOJAN, date: DATE, kind: 'shift', locationId: LOC_A, templateId: TPL_A }),
  );
  const shift = await getPool().query(
    `SELECT location_id, shift_template_id FROM schedule_exceptions WHERE staff_id = $1 AND work_date = $2::date`,
    [BOJAN, DATE],
  );
  assert.equal(shift.rows[0].shift_template_id, TPL_A);

  await asUser(OWNER_USER, (client, ctx) => deleteException(client, ctx, { staffId: BOJAN, date: DATE, locationId: LOC_A }));
  const gone = await getPool().query(
    `SELECT 1 FROM schedule_exceptions WHERE staff_id = $1 AND work_date = $2::date`,
    [BOJAN, DATE],
  );
  assert.equal(gone.rowCount, 0);
});

test('izmena sablona i nedeljni unos idu u audit log', async () => {
  await asUser(OWNER_USER, (client, ctx) =>
    updateShiftTemplate(client, ctx, { templateId: TPL_A, name: 'Prva A', start: '08:30', end: '15:00' }),
  );
  const audit = await getPool().query(
    `SELECT action FROM audit_log WHERE organization_id = $1 AND object_id = $2 ORDER BY id`,
    [ORG, TPL_A],
  );
  assert.ok(audit.rows.some((r) => r.action === 'schedule.template.update'));
});
