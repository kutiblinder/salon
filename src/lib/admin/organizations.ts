import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { AdminError, type PlatformSession } from './core';
import { parseLocationName, parseSlug, slugFromName } from './organizations-parse';

export { parseLocationName, parseSlug, slugFromName } from './organizations-parse';

const UNIQUE_VIOLATION = '23505';

export interface CreatedOrganization {
  id: string;
  name: string;
  slug: string;
  locationId: string;
}

/**
 * Novi salon (nacrt) sa prvim objektom. Posle upisa admin ulazi u taj salon (sesija).
 */
export async function createOrganization(
  client: PoolClient,
  session: PlatformSession,
  input: { name: string; slug: string; locationName: string },
): Promise<CreatedOrganization> {
  let orgId: string;
  try {
    const org = await client.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, status) VALUES ($1, $2, 'draft') RETURNING id`,
      [input.name, input.slug],
    );
    orgId = org.rows[0].id;
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new AdminError('Taj slug je već zauzet.');
    }
    throw error;
  }

  await client.query("SELECT set_config('app.organization_id', $1, true)", [orgId]);

  const loc = await client.query<{ id: string }>(
    `INSERT INTO locations (organization_id, name, timezone, slot_step_min)
     VALUES ($1, $2, 'Europe/Belgrade', 15) RETURNING id`,
    [orgId, input.locationName],
  );
  const locationId = loc.rows[0].id;

  await writeAudit(client, {
    organizationId: orgId,
    userId: session.user.id,
    action: 'organization.create',
    objectType: 'organization',
    objectId: orgId,
    newValue: { name: input.name, slug: input.slug, locationId },
  });

  await client.query(
    `UPDATE sessions SET active_organization_id = $1, updated_at = now()
      WHERE id = $2 AND organization_id IS NULL`,
    [orgId, session.sessionId],
  );
  await writeAudit(client, {
    organizationId: orgId,
    userId: session.user.id,
    action: 'admin.enter_organization',
    objectType: 'organization',
    objectId: orgId,
  });

  return { id: orgId, name: input.name, slug: input.slug, locationId };
}

/**
 * Briše salon i sve njegove podatke. Vraća ključeve slika da se obrišu sa diska posle COMMIT.
 */
export async function deleteOrganization(
  client: PoolClient,
  session: PlatformSession,
  organizationId: string,
): Promise<string[]> {
  const org = await client.query<{ name: string; slug: string }>(
    `SELECT name, slug FROM organizations WHERE id = $1`,
    [organizationId],
  );
  if (!org.rows[0]) throw new AdminError('Salon ne postoji.');

  await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);

  const future = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM appointments
      WHERE organization_id = $1 AND status IN ('pending', 'confirmed') AND starts_at > now()`,
    [organizationId],
  );
  if (future.rows[0].n > 0) {
    throw new AdminError('Salon ima zakazane termine. Otkažite ih pa obrišite salon.');
  }

  const media = await client.query<{ storage_key: string }>(
    `SELECT storage_key FROM media WHERE organization_id = $1`,
    [organizationId],
  );

  await writeAudit(client, {
    organizationId,
    userId: session.user.id,
    action: 'organization.delete',
    objectType: 'organization',
    objectId: organizationId,
    oldValue: org.rows[0],
  });

  await client.query(
    `UPDATE sessions SET active_organization_id = NULL, updated_at = now()
      WHERE active_organization_id = $1`,
    [organizationId],
  );
  await client.query(`DELETE FROM appointments WHERE organization_id = $1`, [organizationId]);
  await client.query(`UPDATE media SET uploaded_by = NULL WHERE organization_id = $1`, [organizationId]);
  await client.query(
    `UPDATE site_content_history h SET changed_by = NULL
        FROM site_content c
       WHERE h.site_content_id = c.id AND c.organization_id = $1`,
    [organizationId],
  );
  await client.query(`UPDATE site_content SET updated_by = NULL WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
  return media.rows.map((r) => r.storage_key);
}
