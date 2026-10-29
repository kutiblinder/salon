import { redirect } from 'next/navigation';
import { localDateOf, zonedTimeToUtcMs } from '@/lib/availability/time';
import { panelQuery, requirePanel } from '@/lib/panel/context';
import { loadManageableStaff, loadTimeOff } from '@/lib/panel/time-off';
import { TimeOffForm } from './time-off-form';

export const metadata = { title: 'Odsustva' };

export default async function TimeOffPage() {
  const ctx = await requirePanel();
  if (ctx.locationsFor('schedule.manage').length === 0) redirect('/panel');
  const timezone = ctx.locations[0]?.timezone ?? 'Europe/Belgrade';
  const today = localDateOf(Date.now(), timezone);
  const fromMs = zonedTimeToUtcMs(today, '00:00', timezone);

  const { staff, entries } = await panelQuery(ctx, async (client) => {
    const staff = await loadManageableStaff(client, ctx);
    return { staff, entries: await loadTimeOff(client, ctx, staff, fromMs) };
  });

  return (
    <main>
      <h1 className="text-2xl font-semibold">Odsustva</h1>
      <p className="mt-1 text-neutral-600">Pauze, godišnji i bolovanje. Oduzimaju se od smene pri zakazivanju.</p>
      <div className="mt-6">
        {staff.length === 0 ? (
          <p className="text-sm text-neutral-600">Nema zaposlenih koje možete menjati.</p>
        ) : (
          <TimeOffForm staff={staff} entries={entries} timezone={timezone} />
        )}
      </div>
    </main>
  );
}
