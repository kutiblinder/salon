/**
 * Probne slike galerije (SVG → WebP). Pokreće se iz `npm run db:seed`.
 */
import pg from 'pg';
import sharp from 'sharp';
import { putObject } from '../src/lib/storage';

const DEMO = '11111111-1111-4111-8111-111111111111';
const SAJT2 = '11111111-1111-4111-8111-111111111112';
const SAJT3 = '11111111-1111-4111-8111-111111111113';

interface Shot {
  mediaId: string;
  itemId: string;
  organizationId: string;
  bg: string;
  fg: string;
  accent: string;
  label: string;
  alt: string;
  caption: string;
  sort: number;
}

const SHOTS: Shot[] = [
  {
    mediaId: '77777777-7777-4777-8777-777777777711',
    itemId: '88888888-8888-4888-8888-888888888811',
    organizationId: DEMO,
    bg: '#8b1e3f',
    fg: '#ffffff',
    accent: '#f4c7d3',
    label: 'Enterijer',
    alt: 'Enterijer Demo salona u Zemunu',
    caption: 'Sala u Zemunu',
    sort: 0,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777712',
    itemId: '88888888-8888-4888-8888-888888888812',
    organizationId: DEMO,
    bg: '#5c1429',
    fg: '#ffffff',
    accent: '#e8a0b0',
    label: 'Šišanje',
    alt: 'Radno mesto za šišanje',
    caption: 'Fade i klasično',
    sort: 1,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777713',
    itemId: '88888888-8888-4888-8888-888888888813',
    organizationId: DEMO,
    bg: '#2a0a14',
    fg: '#f4c7d3',
    accent: '#8b1e3f',
    label: 'Brada',
    alt: 'Nega brade',
    caption: 'Nega brade',
    sort: 2,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777721',
    itemId: '88888888-8888-4888-8888-888888888821',
    organizationId: SAJT2,
    bg: '#0f766e',
    fg: '#ffffff',
    accent: '#99f6e4',
    label: 'Novi Sad',
    alt: 'Salon dva u Novom Sadu',
    caption: 'Dunavska',
    sort: 0,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777722',
    itemId: '88888888-8888-4888-8888-888888888822',
    organizationId: SAJT2,
    bg: '#115e59',
    fg: '#ffffff',
    accent: '#5eead4',
    label: 'Šišanje',
    alt: 'Šišanje u Salonu dva',
    caption: 'Šišanje',
    sort: 1,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777723',
    itemId: '88888888-8888-4888-8888-888888888823',
    organizationId: SAJT2,
    bg: '#134e4a',
    fg: '#ccfbf1',
    accent: '#0f766e',
    label: 'Brada',
    alt: 'Korekcija brade',
    caption: 'Brada',
    sort: 2,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777731',
    itemId: '88888888-8888-4888-8888-888888888831',
    organizationId: SAJT3,
    bg: '#7c3aed',
    fg: '#ffffff',
    accent: '#ddd6fe',
    label: 'Niš',
    alt: 'Salon tri u Nišu',
    caption: 'Obrenovićeva',
    sort: 0,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777732',
    itemId: '88888888-8888-4888-8888-888888888832',
    organizationId: SAJT3,
    bg: '#6d28d9',
    fg: '#ffffff',
    accent: '#c4b5fd',
    label: 'Manikir',
    alt: 'Manikir u Salonu tri',
    caption: 'Manikir',
    sort: 1,
  },
  {
    mediaId: '77777777-7777-4777-8777-777777777733',
    itemId: '88888888-8888-4888-8888-888888888833',
    organizationId: SAJT3,
    bg: '#5b21b6',
    fg: '#ede9fe',
    accent: '#7c3aed',
    label: 'Pedikir',
    alt: 'Pedikir u Salonu tri',
    caption: 'Pedikir',
    sort: 2,
  },
];

function svgFor(shot: Shot): Buffer {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="${shot.bg}"/>
  <circle cx="180" cy="160" r="120" fill="${shot.accent}" fill-opacity="0.35"/>
  <circle cx="1080" cy="680" r="180" fill="${shot.accent}" fill-opacity="0.25"/>
  <rect x="80" y="80" width="1040" height="640" rx="24" fill="none" stroke="${shot.fg}" stroke-opacity="0.25" stroke-width="2"/>
  <text x="600" y="390" text-anchor="middle" fill="${shot.fg}" font-size="72" font-family="Segoe UI, Arial, sans-serif">${escapeXml(shot.label)}</text>
  <text x="600" y="460" text-anchor="middle" fill="${shot.accent}" font-size="28" font-family="Segoe UI, Arial, sans-serif">${escapeXml(shot.caption)}</text>
</svg>`;
  return Buffer.from(svg);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function upsertShot(client: pg.Client, shot: Shot): Promise<void> {
  const webp = await sharp(svgFor(shot)).webp({ quality: 80 }).toBuffer();
  const meta = await sharp(webp).metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 800;
  const key = `${shot.organizationId}/${shot.mediaId}.webp`;

  await client.query(
    `INSERT INTO media (id, organization_id, storage_key, mime_type, width, height, size_bytes)
     VALUES ($1, $2, $3, 'image/webp', $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       storage_key = EXCLUDED.storage_key,
       mime_type = EXCLUDED.mime_type,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       size_bytes = EXCLUDED.size_bytes`,
    [shot.mediaId, shot.organizationId, key, width, height, webp.length],
  );
  await client.query(
    `INSERT INTO gallery_items (id, organization_id, media_id, alt_text, caption, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       alt_text = EXCLUDED.alt_text,
       caption = EXCLUDED.caption,
       sort_order = EXCLUDED.sort_order`,
    [shot.itemId, shot.organizationId, shot.mediaId, shot.alt, shot.caption, shot.sort],
  );
  await putObject(key, webp);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL nije podesen.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const shot of SHOTS) await upsertShot(client, shot);
    await client.query('COMMIT');
    console.log(`Galerija: ${SHOTS.length} slika`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
