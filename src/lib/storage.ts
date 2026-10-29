import fs from 'node:fs/promises';
import path from 'node:path';

/** Lokalni disk (isti volume na Hetzneru). S3/R2 se prikljucuje kad bude nalog. */
export function storageRoot(): string {
  return process.env.STORAGE_DIR ?? path.join(process.cwd(), 'data', 'media');
}

function resolveKey(key: string): string {
  if (!key || key.includes('\0') || key.includes('..') || path.isAbsolute(key)) {
    throw new Error('invalid storage key');
  }
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.resolve(storageRoot(), normalized);
  const root = path.resolve(storageRoot());
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error('invalid storage key');
  return full;
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}
