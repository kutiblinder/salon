import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, type Actor, type Membership, type PermissionRules } from './permissions';

const ORG = 'org-1';
const OTHER = 'org-2';
const LOC_A = 'loc-a';
const LOC_B = 'loc-b';

// Isto kao seed u 001_init.sql
const RULES: PermissionRules = {
  defaults: [
    ...['content.edit', 'gallery.edit', 'prices.edit', 'services.edit', 'locations.manage', 'staff.manage',
      'schedule.manage', 'appointments.manage', 'clients.view'].map((permission) => ({
      role: 'admin' as const, permission, ownOnly: false,
    })),
    ...['locations.manage', 'staff.manage', 'schedule.manage', 'appointments.manage', 'clients.view'].map(
      (permission) => ({ role: 'owner' as const, permission, ownOnly: false }),
    ),
    ...['schedule.manage', 'appointments.manage', 'clients.view'].map((permission) => ({
      role: 'manager' as const, permission, ownOnly: false,
    })),
    ...['schedule.manage', 'appointments.manage', 'clients.view'].map((permission) => ({
      role: 'staff' as const, permission, ownOnly: true,
    })),
  ],
  overrides: [],
};

function actor(memberships: Membership[], extra: Partial<Actor> = {}): Actor {
  return { userId: 'u', organizationId: ORG, activeOrganizationId: null, memberships, staffIds: [], ...extra };
}
const owner = actor([{ role: 'owner', scope: 'organization', organizationId: ORG, locationId: null }]);
const managerA = actor([{ role: 'manager', scope: 'location', organizationId: ORG, locationId: LOC_A }]);
const staffMember = actor([{ role: 'staff', scope: 'organization', organizationId: ORG, locationId: null }], {
  staffIds: ['staff-1'],
});
const admin = actor([{ role: 'admin', scope: 'platform', organizationId: null, locationId: null }], {
  organizationId: null,
  activeOrganizationId: ORG,
});

test('vlasnik: operativa da, sadrzaj i cene ne (dok admin ne ukljuci prekidac)', () => {
  assert.equal(can(owner, 'staff.manage', { organizationId: ORG }, RULES), true);
  assert.equal(can(owner, 'appointments.manage', { organizationId: ORG, locationId: LOC_B }, RULES), true);
  assert.equal(can(owner, 'content.edit', { organizationId: ORG }, RULES), false);
  assert.equal(can(owner, 'prices.edit', { organizationId: ORG }, RULES), false);
});

test('izuzetak po salonu: prekidac daje ili oduzima dozvolu uloge', () => {
  const rules: PermissionRules = {
    ...RULES,
    overrides: [
      { role: 'owner', permission: 'prices.edit', granted: true },
      { role: 'owner', permission: 'staff.manage', granted: false },
    ],
  };
  assert.equal(can(owner, 'prices.edit', { organizationId: ORG }, rules), true);
  assert.equal(can(owner, 'staff.manage', { organizationId: ORG }, rules), false);
});

test('nalog drugog salona nema nikakve dozvole', () => {
  assert.equal(can(owner, 'appointments.manage', { organizationId: OTHER }, RULES), false);
  // Clanstvo koje bi (greskom) pokazivalo na drugi salon ne pomaze
  const odd = actor([{ role: 'owner', scope: 'organization', organizationId: OTHER, locationId: null }]);
  assert.equal(can(odd, 'appointments.manage', { organizationId: OTHER }, RULES), false);
});

test('clanstvo na lokaciji vazi samo za tu lokaciju', () => {
  assert.equal(can(managerA, 'schedule.manage', { organizationId: ORG, locationId: LOC_A }, RULES), true);
  assert.equal(can(managerA, 'schedule.manage', { organizationId: ORG, locationId: LOC_B }, RULES), false);
  assert.equal(can(managerA, 'schedule.manage', { organizationId: ORG }, RULES), false);
});

test('zaposleni: samo svoje', () => {
  assert.equal(can(staffMember, 'appointments.manage', { organizationId: ORG, staffId: 'staff-1' }, RULES), true);
  assert.equal(can(staffMember, 'appointments.manage', { organizationId: ORG, staffId: 'staff-2' }, RULES), false);
  assert.equal(can(staffMember, 'appointments.manage', { organizationId: ORG }, RULES), false);
  assert.equal(can(staffMember, 'staff.manage', { organizationId: ORG, staffId: 'staff-1' }, RULES), false);
});

test('admin platforme radi samo u salonu u koji je usao', () => {
  assert.equal(can(admin, 'prices.edit', { organizationId: ORG }, RULES), true);
  assert.equal(can(admin, 'prices.edit', { organizationId: OTHER }, RULES), false);
  assert.equal(can({ ...admin, activeOrganizationId: null }, 'prices.edit', { organizationId: ORG }, RULES), false);
  // Izuzeci po salonu ne oduzimaju dozvole adminu
  const rules = { ...RULES, overrides: [{ role: 'admin' as const, permission: 'prices.edit', granted: false }] };
  assert.equal(can(admin, 'prices.edit', { organizationId: ORG }, rules), true);
});

test('klijent (nalog bez clanstva) i nalog platforme bez admin uloge nemaju dozvole', () => {
  assert.equal(can(actor([]), 'clients.view', { organizationId: ORG }, RULES), false);
  const platformUser = actor([], { organizationId: null, activeOrganizationId: ORG });
  assert.equal(can(platformUser, 'clients.view', { organizationId: ORG }, RULES), false);
});
