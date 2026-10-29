import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { dropOrganizationSessions } from '../staff-account';
import { AdminError, type AdminContext } from './core';
import {
  CONTENT_FIELDS,
  CONTENT_LANGUAGE,
  fieldId,
  findContentField,
  type ContentBundle,
  type PublishStatus,
  type SalonSettings,
} from './content-types';
import { parseSlug } from './organizations-parse';
import { parseHexColor } from './theme';

export type { ContentBundle, SalonSettings } from './content-types';
export { CONTENT_FIELDS, CONTENT_LANGUAGE, fieldId, findContentField } from './content-types';

export function parseOrgName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 ? name : null;
}

export function parsePublishStatus(raw: unknown): PublishStatus | null {
  return raw === 'draft' || raw === 'published' || raw === 'inactive' ? raw : null;
}

export function publishStatusLabel(status: string): string {
  if (status === 'published') return 'objavljen';
  if (status === 'inactive') return 'neaktivan';
  return 'nacrt';
}

/** Prazno = obrisi sadrzaj; predugo = undefined. */
export function parseFieldValue(raw: unknown, maxLength: number): string | undefined {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') return undefined;
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (text.length > maxLength) return undefined;
  return text;
}

function jsonbText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'text' in value && typeof (value as { text: unknown }).text === 'string') {
    return (value as { text: string }).text;
  }
  return '';
}

export async function loadContent(client: PoolClient, ctx: AdminContext): Promise<ContentBundle> {
  ctx.require('content.edit');
  const res = await client.query<{ page: string; key: string; value: unknown }>(
    `SELECT page, key, value FROM site_content
      WHERE organization_id = $1 AND language = $2 AND status = 'published'`,
    [ctx.organizationId, CONTENT_LANGUAGE],
  );
  const values: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) values[fieldId(field)] = '';
  for (const row of res.rows) {
    if (!findContentField(row.page, row.key)) continue;
    values[fieldId(row)] = jsonbText(row.value);
  }
  return { salon: ctx.salon, values };
}

const UNIQUE_VIOLATION = '23505';

export async function saveContent(
  client: PoolClient,
  ctx: AdminContext,
  input: {
    name: string;
    slug: string;
    status: PublishStatus;
    primaryColor: string | null;
    guestConfirmEmail: boolean;
    values: Record<string, string>;
  },
): Promise<void> {
  ctx.require('content.edit');

  const oldSalon = ctx.salon;
  const oldContent = await client.query<{ page: string; key: string; value: unknown; id: string; version: number }>(
    `SELECT id, page, key, value, version FROM site_content
      WHERE organization_id = $1 AND language = $2 AND status = 'published'`,
    [ctx.organizationId, CONTENT_LANGUAGE],
  );
  const previous = new Map(oldContent.rows.map((r) => [fieldId(r), r]));

  try {
    await client.query(
      `UPDATE organizations
          SET name = $2, slug = $3, status = $4,
              theme = jsonb_set(theme, '{primaryColor}', $5::jsonb, true),
              guest_confirm_email = $6
        WHERE id = $1`,
      [
        ctx.organizationId,
        input.name,
        input.slug,
        input.status,
        JSON.stringify(input.primaryColor),
        input.guestConfirmEmail,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new AdminError('Taj poddomen je već zauzet.');
    }
    throw error;
  }

  const changed: Record<string, { old: string; new: string }> = {};
  for (const field of CONTENT_FIELDS) {
    const id = fieldId(field);
    const next = input.values[id] ?? '';
    const prevRow = previous.get(id);
    const prev = prevRow ? jsonbText(prevRow.value) : '';
    if (next === prev) continue;
    changed[id] = { old: prev, new: next };

    if (prevRow) {
      await client.query(
        `INSERT INTO site_content_history (site_content_id, value, version, changed_by)
         VALUES ($1, $2::jsonb, $3, $4)`,
        [prevRow.id, JSON.stringify(prev), prevRow.version, ctx.actor.userId],
      );
      await client.query(
        `UPDATE site_content
            SET value = $2::jsonb, version = version + 1, updated_by = $3, updated_at = now()
          WHERE id = $1`,
        [prevRow.id, JSON.stringify(next), ctx.actor.userId],
      );
    } else if (next !== '') {
      await client.query(
        `INSERT INTO site_content (organization_id, page, key, language, value, status, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'published', $6)`,
        [ctx.organizationId, field.page, field.key, CONTENT_LANGUAGE, JSON.stringify(next), ctx.actor.userId],
      );
    }
  }

  const salonChanged =
    oldSalon.name !== input.name ||
    oldSalon.slug !== input.slug ||
    oldSalon.status !== input.status ||
    oldSalon.primaryColor !== input.primaryColor ||
    oldSalon.guestConfirmEmail !== input.guestConfirmEmail;
  if (!salonChanged && Object.keys(changed).length === 0) return;

  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'content.update',
    objectType: 'organization',
    objectId: ctx.organizationId,
    oldValue: {
      name: oldSalon.name,
      slug: oldSalon.slug,
      status: oldSalon.status,
      primaryColor: oldSalon.primaryColor,
      guestConfirmEmail: oldSalon.guestConfirmEmail,
      fields: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.old])),
    },
    newValue: {
      name: input.name,
      slug: input.slug,
      status: input.status,
      primaryColor: input.primaryColor,
      guestConfirmEmail: input.guestConfirmEmail,
      fields: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.new])),
    },
  });
  if (input.status === 'inactive' && oldSalon.status !== 'inactive') {
    await dropOrganizationSessions(client, ctx.organizationId);
  }
}

export function parseContentForm(
  raw: {
    name: unknown;
    slug: unknown;
    status: unknown;
    primaryColor: unknown;
    guestConfirmEmail?: unknown;
    values: Record<string, unknown>;
  },
):
  | {
      name: string;
      slug: string;
      status: PublishStatus;
      primaryColor: string | null;
      guestConfirmEmail: boolean;
      values: Record<string, string>;
    }
  | { error: string } {
  const name = parseOrgName(raw.name);
  if (!name) return { error: 'Naziv salona mora imati 2–80 karaktera.' };
  const slug = parseSlug(raw.slug);
  if (!slug) {
    return { error: 'Poddomen: 2–50 znakova, mala slova, brojevi i crtica (npr. frizer-ana).' };
  }
  const status = parsePublishStatus(raw.status);
  if (!status) return { error: 'Izaberite status sajta.' };
  const colorRaw = typeof raw.primaryColor === 'string' ? raw.primaryColor.trim() : '';
  const primaryColor = colorRaw === '' ? null : parseHexColor(colorRaw);
  if (colorRaw !== '' && !primaryColor) return { error: 'Boja mora biti u formatu #RRGGBB.' };
  const guestConfirmEmail = raw.guestConfirmEmail === true || raw.guestConfirmEmail === '1' || raw.guestConfirmEmail === 'on';

  const values: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) {
    const parsed = parseFieldValue(raw.values[fieldId(field)], field.maxLength);
    if (parsed === undefined) return { error: `Polje „${field.label}“ je predugačko.` };
    values[fieldId(field)] = parsed;
  }
  return { name, slug, status, primaryColor, guestConfirmEmail, values };
}
