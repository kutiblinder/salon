/**
 * Probne slike galerije (JPEG iz db/seed/gallery → WebP). Pokreće se iz `npm run db:seed`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { putObject } from '../src/lib/storage';

const ROOT = path.join(process.cwd(), 'db', 'seed', 'gallery');

interface Shot {
  mediaId: string;
  itemId: string;
  organizationId: string;
  file: string;
  alt: string;
  caption: string;
  sort: number;
}

const SHOTS: Shot[] = [
  {
    mediaId: '1',
    itemId: '1',
    organizationId: '1',
    file: 'atelje-enterijer.jpg',
    alt: 'Enterijer Ateljea Kosić u Zemunu, barberske stolice i ogledala',
    caption: 'Zemun, Glavna',
    sort: 0,
  },
  {
    mediaId: '2',
    itemId: '2',
    organizationId: '1',
    file: 'atelje-fade.jpg',
    alt: 'Fade šišanje u Ateljeu Kosić',
    caption: 'Fade',
    sort: 1,
  },
  {
    mediaId: '3',
    itemId: '3',
    organizationId: '1',
    file: 'atelje-brada.jpg',
    alt: 'Korekcija brade u Ateljeu Kosić',
    caption: 'Brada',
    sort: 2,
  },
  {
    mediaId: '4',
    itemId: '4',
    organizationId: '2',
    file: 'zen-soba.jpg',
    alt: 'Kabina za masažu u studiju Zen na Vračaru',
    caption: 'Kabina',
    sort: 0,
  },
  {
    mediaId: '5',
    itemId: '5',
    organizationId: '2',
    file: 'zen-masaza.jpg',
    alt: 'Relaks masaža leđa u Zen Masaži',
    caption: 'Masaža',
    sort: 1,
  },
  {
    mediaId: '6',
    itemId: '6',
    organizationId: '2',
    file: 'zen-ulja.jpg',
    alt: 'Ulja i peškiri u studiju Zen Masaža',
    caption: 'Nega',
    sort: 2,
  },
  {
    mediaId: '7',
    itemId: '7',
    organizationId: '3',
    file: 'bella-studio.jpg',
    alt: 'Studio Bella Nails u Kralja Petra',
    caption: 'Studio',
    sort: 0,
  },
  {
    mediaId: '8',
    itemId: '8',
    organizationId: '3',
    file: 'bella-manikir.jpg',
    alt: 'Gel lak manikir u Bella Nails',
    caption: 'Manikir',
    sort: 1,
  },
  {
    mediaId: '9',
    itemId: '9',
    organizationId: '3',
    file: 'bella-pedikir.jpg',
    alt: 'Pedikir stanica u Bella Nails',
    caption: 'Pedikir',
    sort: 2,
  },
];

async function upsertShot(client: pg.Client, shot: Shot): Promise<void> {
  const source = readFileSync(path.join(ROOT, shot.file));
  const webp = await sharp(source).rotate().resize(1600, 1067, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  const meta = await sharp(webp).metadata();
  const width = meta.width ?? 1600;
  const height = meta.height ?? 1067;
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
    await client.query(`SELECT setval(pg_get_serial_sequence('media', 'id'), (SELECT max(id) FROM media))`);
    await client.query(
      `SELECT setval(pg_get_serial_sequence('gallery_items', 'id'), (SELECT max(id) FROM gallery_items))`,
    );
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
