/**
 * Upisuje 127.0.0.1 localhost.rs / sajt2.rs / sajt3.rs u sistemski hosts fajl.
 * Windows: pokreni PowerShell kao Administrator: npm run hosts:dev
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const DEV_SALON_DOMAINS = ['localhost.rs', 'sajt2.rs', 'sajt3.rs'] as const;

const BEGIN = '# salon-dev-hosts';
const END = '# salon-dev-hosts-end';

function hostsPath(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

function block(): string {
  const lines = DEV_SALON_DOMAINS.map((d) => `127.0.0.1 ${d}`);
  return [BEGIN, ...lines, END].join('\n');
}

function apply(existing: string): string {
  const text = existing.replace(/\r\n/g, '\n');
  const next = `${block()}\n`;
  if (text.includes(BEGIN) && text.includes(END)) {
    return text.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`), next);
  }
  const trimmed = text.replace(/\n+$/, '');
  return `${trimmed}\n\n${next}`;
}

function main(): void {
  const file = hostsPath();
  let current: string;
  try {
    current = readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`Ne mogu da pročitam ${file}:`, error);
    process.exit(1);
  }

  const updated = apply(current);
  if (updated === current.replace(/\r\n/g, '\n') || updated === current) {
    console.log('Hosts već ima lokalne salone:');
    for (const d of DEV_SALON_DOMAINS) console.log(`  http://${d}:3000`);
    return;
  }

  try {
    writeFileSync(file, updated, 'utf8');
  } catch {
    console.error(`Nema dozvole za upis u ${file}.`);
    console.error('Pokreni PowerShell kao Administrator, pa: npm run hosts:dev');
    console.error('Ili ručno dodaj u hosts:');
    for (const d of DEV_SALON_DOMAINS) console.error(`  127.0.0.1 ${d}`);
    process.exit(1);
  }

  console.log('Upisano u hosts. Otvori:');
  for (const d of DEV_SALON_DOMAINS) console.log(`  http://${d}:3000`);
  console.log('Admin ostaje: http://localhost:3000/admin');
}

main();
