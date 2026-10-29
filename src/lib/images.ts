import sharp from 'sharp';
import { GALLERY_MAX_EDGE } from './admin/gallery-types';

export function sniffImage(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export async function toWebp(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const converted = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: GALLERY_MAX_EDGE, height: GALLERY_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const meta = await sharp(converted).metadata();
  return { buffer: converted, width: meta.width ?? 0, height: meta.height ?? 0 };
}
