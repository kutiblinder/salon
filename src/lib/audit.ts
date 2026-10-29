import type { ClientBase } from 'pg';

export interface AuditEntry {
  organizationId: string | null;
  userId: string | null;
  /** Dozvola ili radnja: 'prices.edit', 'admin.enter_organization', ... */
  action: string;
  objectType: string;
  objectId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Upis u audit_log. Pozivati sa istim klijentom (transakcijom) kao i samu promenu. */
export async function writeAudit(client: ClientBase, entry: AuditEntry): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (organization_id, user_id, action, object_type, object_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.organizationId,
      entry.userId,
      entry.action,
      entry.objectType,
      entry.objectId ?? null,
      entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue),
      entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
    ],
  );
}
