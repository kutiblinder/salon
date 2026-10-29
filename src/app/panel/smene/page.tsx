import { redirect } from 'next/navigation';
import { localDateOf } from '@/lib/availability/time';
import { loadLocationStaff } from '@/lib/panel/appointments';
import { panelQuery, requirePanel } from '@/lib/panel/context';
import { loadExceptions, loadShiftTemplates, loadWeeklyByLocation } from '@/lib/panel/schedule';
import { ExceptionsEditor } from './exceptions-editor';
import { TemplatesEditor } from './templates-editor';
import { WeeklyEditor } from './weekly-editor';

export const metadata = { title: 'Smene' };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ lokacija?: string }>;
}) {
  const ctx = await requirePanel();
  const params = await searchParams;
  const locations = ctx.locationsFor('schedule.manage');
  if (locations.length === 0) redirect('/panel');
  const location = locations.find((l) => l.id === params.lokacija) ?? locations[0];
  const canEditTemplates = ctx.canAll('schedule.manage', location.id);
  const today = localDateOf(Date.now(), location.timezone);

  const { templates, staff, weekly, exceptions } = await panelQuery(ctx, async (client) => {
    const allStaff = await loadLocationStaff(client, ctx.organizationId, location.id);
    const staff = allStaff.filter((s) => ctx.can('schedule.manage', { locationId: location.id, staffId: s.id }));
    const templates = await loadShiftTemplates(client, ctx.organizationId, location.id);
    return {
      templates,
      staff,
      weekly: await loadWeeklyByLocation(client, ctx, location.id, staff),
      exceptions: await loadExceptions(client, ctx.organizationId, staff.map((s) => s.id), today),
    };
  });

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Smene</h1>
          <p className="mt-1 text-neutral-600">Šabloni, nedeljni raspored i izuzeci za konkretan dan.</p>
        </div>
        {locations.length > 1 && (
          <form className="flex flex-wrap items-end gap-2" action="/panel/smene">
            <select name="lokacija" defaultValue={location.id} className="rounded-md border border-neutral-300 px-3 py-2">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium">
              Prikaži
            </button>
          </form>
        )}
      </div>
      {locations.length > 1 && <p className="mt-2 text-sm text-neutral-600">{location.name}</p>}

      <div className="mt-6 space-y-6">
        {canEditTemplates ? (
          <TemplatesEditor locationId={location.id} templates={templates} />
        ) : (
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="font-medium">Šabloni smena</h2>
            <ul className="mt-2 list-inside list-disc text-sm text-neutral-700">
              {templates.map((t) => (
                <li key={t.id}>
                  {t.name} ({t.startsAt}–{t.endsAt})
                </li>
              ))}
            </ul>
          </section>
        )}
        <WeeklyEditor locationId={location.id} templates={templates} weekly={weekly} />
        <ExceptionsEditor
          locationId={location.id}
          staff={staff}
          templates={templates}
          exceptions={exceptions.map((ex) => ({
            ...ex,
            canDelete:
              !ex.locationId ||
              ctx.can('schedule.manage', { locationId: ex.locationId, staffId: ex.staffId }),
          }))}
          today={today}
        />
      </div>
    </main>
  );
}
