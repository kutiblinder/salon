import type { PoolClient } from 'pg';
import { CONTENT_FIELDS, CONTENT_LANGUAGE, fieldId, findContentField } from '../admin/content-types';
import { parseHexColor } from '../admin/theme';
import { bookableLocations } from './booking';
import type { BookingCatalog, SiteGalleryItem, SiteLocation, SiteOffer, SiteSalon, SiteStaff } from './types';

export type { BookingCatalog, SiteGalleryItem, SiteLocation, SiteOffer, SiteSalon, SiteStaff } from './types';

function jsonbText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'text' in value && typeof (value as { text: unknown }).text === 'string') {
    return (value as { text: string }).text;
  }
  return '';
}

const SCHEMA_TYPES = new Set(['HairSalon', 'DaySpa', 'NailSalon']);

function schemaTypeOf(theme: { schemaType?: unknown }): SiteSalon['schemaType'] {
  return typeof theme.schemaType === 'string' && SCHEMA_TYPES.has(theme.schemaType)
    ? (theme.schemaType as SiteSalon['schemaType'])
    : 'HairSalon';
}

export async function loadSiteSalon(client: PoolClient, organizationId: string): Promise<SiteSalon | null> {
  const res = await client.query<{
    id: string;
    name: string;
    slug: string;
    status: 'draft' | 'published' | 'inactive';
    theme: unknown;
    guest_confirm_email: boolean;
  }>(`SELECT id, name, slug, status, theme, guest_confirm_email FROM organizations WHERE id = $1`, [organizationId]);
  const row = res.rows[0];
  if (!row) return null;
  const theme =
    row.theme && typeof row.theme === 'object' && !Array.isArray(row.theme)
      ? (row.theme as { primaryColor?: unknown; schemaType?: unknown })
      : {};
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    primaryColor: parseHexColor(theme.primaryColor),
    guestConfirmEmail: row.guest_confirm_email,
    schemaType: schemaTypeOf(theme),
  };
}

export async function loadSiteContent(client: PoolClient, organizationId: string): Promise<Record<string, string>> {
  const res = await client.query<{ page: string; key: string; value: unknown }>(
    `SELECT page, key, value FROM site_content
      WHERE organization_id = $1 AND language = $2 AND status = 'published'`,
    [organizationId, CONTENT_LANGUAGE],
  );
  const values: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) values[fieldId(field)] = '';
  for (const row of res.rows) {
    if (!findContentField(row.page, row.key)) continue;
    values[fieldId(row)] = jsonbText(row.value);
  }
  return values;
}

export async function loadSiteLocations(client: PoolClient, organizationId: string): Promise<SiteLocation[]> {
  const locs = await client.query<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
  }>(
    `SELECT id, name, address, city, phone, email FROM locations
      WHERE organization_id = $1 AND is_active ORDER BY sort_order, name`,
    [organizationId],
  );
  const hours = await client.query<{ location_id: string; weekday: number; opens: string; closes: string }>(
    `SELECT h.location_id, h.weekday, to_char(h.opens_at, 'HH24:MI') AS opens, to_char(h.closes_at, 'HH24:MI') AS closes
       FROM location_hours h JOIN locations l ON l.id = h.location_id
      WHERE l.organization_id = $1 AND l.is_active
      ORDER BY h.weekday`,
    [organizationId],
  );
  const byLoc = new Map<string, SiteLocation['hours']>();
  for (const h of hours.rows) {
    const list = byLoc.get(h.location_id) ?? [];
    list.push({ weekday: h.weekday, opens: h.opens, closes: h.closes });
    byLoc.set(h.location_id, list);
  }
  return locs.rows.map((l) => ({ ...l, hours: byLoc.get(l.id) ?? [] }));
}

export async function loadSiteStaff(client: PoolClient, organizationId: string): Promise<SiteStaff[]> {
  const res = await client.query<{ id: string; display_name: string; title: string | null; bio: string | null }>(
    `SELECT id, display_name, title, bio FROM staff
      WHERE organization_id = $1 AND is_active ORDER BY sort_order, display_name`,
    [organizationId],
  );
  return res.rows.map((r) => ({ id: r.id, name: r.display_name, title: r.title, bio: r.bio }));
}

export async function loadSiteOffers(client: PoolClient, organizationId: string): Promise<SiteOffer[]> {
  const res = await client.query<{
    location_id: string;
    location_name: string;
    service_id: string;
    name: string;
    description: string | null;
    price: string;
    currency: string;
    duration_min: number;
  }>(
    `SELECT l.id AS location_id, l.name AS location_name, s.id AS service_id, s.name, s.description,
            ls.price::text AS price, ls.currency, ls.duration_min
       FROM location_services ls
       JOIN locations l ON l.id = ls.location_id AND l.organization_id = $1 AND l.is_active
       JOIN services s ON s.id = ls.service_id AND s.organization_id = $1 AND s.is_active
      WHERE ls.is_active
      ORDER BY l.sort_order, l.name, s.sort_order, s.name`,
    [organizationId],
  );
  return res.rows.map((r) => ({
    locationId: r.location_id,
    locationName: r.location_name,
    serviceId: r.service_id,
    name: r.name,
    description: r.description,
    price: r.price,
    currency: r.currency,
    durationMin: r.duration_min,
  }));
}

export async function loadSiteGallery(client: PoolClient, organizationId: string): Promise<SiteGalleryItem[]> {
  const res = await client.query<{ media_id: string; alt_text: string | null; caption: string | null }>(
    `SELECT g.media_id, g.alt_text, g.caption
       FROM gallery_items g JOIN media m ON m.id = g.media_id
      WHERE g.organization_id = $1
      ORDER BY g.sort_order, g.id`,
    [organizationId],
  );
  return res.rows.map((r) => ({ mediaId: r.media_id, altText: r.alt_text, caption: r.caption }));
}

export async function loadBookingCatalog(client: PoolClient, organizationId: string): Promise<BookingCatalog> {
  const locations = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM locations WHERE organization_id = $1 AND is_active ORDER BY sort_order, name`,
    [organizationId],
  );
  const offers = await loadSiteOffers(client, organizationId);
  const staff = await client.query<{ id: string; name: string; location_id: string; service_id: string }>(
    `SELECT st.id, st.display_name AS name, sl.location_id, ss.service_id
       FROM staff st
       JOIN staff_locations sl ON sl.staff_id = st.id
       JOIN staff_services ss ON ss.staff_id = st.id
       JOIN locations l ON l.id = sl.location_id AND l.organization_id = $1 AND l.is_active
       JOIN services s ON s.id = ss.service_id AND s.organization_id = $1 AND s.is_active
      WHERE st.organization_id = $1 AND st.is_active`,
    [organizationId],
  );
  return {
    locations: bookableLocations(locations.rows, offers),
    offers,
    staff: staff.rows.map((r) => ({
      id: r.id,
      name: r.name,
      locationId: r.location_id,
      serviceId: r.service_id,
    })),
  };
}
