import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import {
  actionLabel,
  actorLabel,
  AUDIT_PAGE_SIZE,
  formatAuditAt,
  formatAuditValue,
  listAuditLogs,
  objectTypeLabel,
} from '@/lib/admin/audit';

export const metadata = { title: 'Logovi' };

export default async function AdminAuditPage() {
  const ctx = await requireAdminSalon();
  const items = await adminQuery(ctx, (client) => listAuditLogs(client, ctx));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Logovi</h1>
      <p className="mt-1 text-neutral-600">Ko je šta menjao u ovom salonu. Lozinke se ne prikazuju.</p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Još nema zapisa za ovaj salon.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((item) => {
            const oldText = formatAuditValue(item.oldValue);
            const newText = formatAuditValue(item.newValue);
            return (
              <li key={item.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
                <p className="text-xs text-neutral-500">{formatAuditAt(item.at)}</p>
                <p className="mt-0.5 font-medium">{actionLabel(item.action)}</p>
                <p className="mt-0.5 text-sm text-neutral-600">{actorLabel(item.actorName, item.actorEmail)}</p>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {objectTypeLabel(item.objectType)}
                  {item.objectId ? ` · ${item.objectId}` : ''}
                </p>
                {(oldText || newText) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-neutral-700">Staro / novo</summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <pre className="overflow-x-auto rounded bg-neutral-50 p-2 text-xs whitespace-pre-wrap">
                        {oldText ?? '—'}
                      </pre>
                      <pre className="overflow-x-auto rounded bg-neutral-50 p-2 text-xs whitespace-pre-wrap">
                        {newText ?? '—'}
                      </pre>
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length >= AUDIT_PAGE_SIZE && (
        <p className="mt-4 text-sm text-neutral-500">Prikazano je poslednjih {AUDIT_PAGE_SIZE} zapisa.</p>
      )}
    </main>
  );
}
