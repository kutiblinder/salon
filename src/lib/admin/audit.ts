import type { PoolClient } from 'pg';
import { ACTION_LABELS, AUDIT_PAGE_SIZE, OBJECT_TYPE_LABELS, type AuditLogItem } from './audit-types';
import type { AdminContext } from './core';

export type { AuditLogItem } from './audit-types';
export { ACTION_LABELS, AUDIT_PAGE_SIZE, OBJECT_TYPE_LABELS } from './audit-types';

const SECRET_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'manage_token_hash',
  'access_token',
  'refresh_token',
]);

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function objectTypeLabel(objectType: string): string {
  return OBJECT_TYPE_LABELS[objectType] ?? objectType;
}

export function formatAuditAt(date: Date, timeZone = 'Europe/Belgrade'): string {
  return new Intl.DateTimeFormat('sr-Latn-RS', {
    timeZone,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function actorLabel(name: string | null, email: string | null): string {
  if (name && email) return `${name} · ${email}`;
  return name || email || 'Sistem';
}

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SECRET_KEYS.has(key) ? '[sakriveno]' : redactAuditValue(nested),
      ]),
    );
  }
  return value;
}

export function formatAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(redactAuditValue(value), null, 2);
}

export async function listAuditLogs(
  client: PoolClient,
  ctx: AdminContext,
  limit = AUDIT_PAGE_SIZE,
): Promise<AuditLogItem[]> {
  const res = await client.query<{
    id: string;
    created_at: Date;
    action: string;
    object_type: string;
    object_id: string | null;
    old_value: unknown;
    new_value: unknown;
    actor_name: string | null;
    actor_email: string | null;
  }>(
    `SELECT a.id, a.created_at, a.action, a.object_type, a.object_id, a.old_value, a.new_value,
            u.full_name AS actor_name, u.email::text AS actor_email
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE a.organization_id = $1
      ORDER BY a.id DESC
      LIMIT $2`,
    [ctx.organizationId, limit],
  );
  return res.rows.map((row) => ({
    id: row.id,
    at: row.created_at,
    action: row.action,
    objectType: row.object_type,
    objectId: row.object_id,
    oldValue: row.old_value,
    newValue: row.new_value,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
  }));
}
