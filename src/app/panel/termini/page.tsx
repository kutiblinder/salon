import Link from 'next/link';
import { redirect } from 'next/navigation';
import { availableActions } from '@/lib/appointments/status';
import { addDays, localDateOf, parseDate } from '@/lib/availability/time';
import { panelQuery, requirePanel } from '@/lib/panel/context';
import {
  loadDayAppointments,
  loadLocationServices,
  loadLocationStaff,
  type DayAppointment,
} from '@/lib/panel/appointments';
import { STATUS_LABELS, STATUS_STYLES, formatDayLabel, formatPrice, formatTime } from '@/lib/panel/format';
import { NewAppointmentForm } from './new-appointment-form';
import { StatusActions } from './status-actions';

export const metadata = { title: 'Termini' };

function validDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = parseDate(value);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? value : null;
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ lokacija?: string; datum?: string; radnik?: string }>;
}) {
  const ctx = await requirePanel();
  const params = await searchParams;

  const locations = ctx.locationsFor('appointments.manage');
  if (locations.length === 0) redirect('/panel');
  const location = locations.find((l) => l.id === params.lokacija) ?? locations[0];

  const nowMs = Date.now();
  const today = localDateOf(nowMs, location.timezone);
  const date = validDate(params.datum) ?? today;

  const { appointments, staff, services } = await panelQuery(ctx, async (client) => ({
    appointments: await loadDayAppointments(client, ctx, location, date),
    staff: await loadLocationStaff(client, ctx.organizationId, location.id),
    services: await loadLocationServices(client, ctx.organizationId, location.id),
  }));

  const allowAnyStaff = ctx.canAll('appointments.manage', location.id);
  const bookableStaff = staff.filter((s) => ctx.can('appointments.manage', { locationId: location.id, staffId: s.id }));
  const staffFilter = bookableStaff.find((s) => s.id === params.radnik)?.id ?? '';
  const visibleStaff = staffFilter ? bookableStaff.filter((s) => s.id === staffFilter) : bookableStaff;
  const showStaffName = visibleStaff.length > 1 || Boolean(staffFilter);
  // Kolone po radniku: svi koje nalog vidi + radnici koji vise nisu na lokaciji a imaju termin
  const columns = visibleStaff.map((s) => ({ ...s, items: appointments.filter((a) => a.staffId === s.id) }));
  const orphan = appointments.filter(
    (a) => !staffFilter && !bookableStaff.some((s) => s.id === a.staffId),
  );
  if (orphan.length > 0) columns.push({ id: 'other', name: 'Ostali', items: orphan });

  const href = (d: string) => {
    const q = new URLSearchParams({ lokacija: location.id, datum: d });
    if (staffFilter) q.set('radnik', staffFilter);
    return `/panel/termini?${q}`;
  };
  const visibleAppointments = staffFilter ? appointments.filter((a) => a.staffId === staffFilter) : appointments;
  const active = visibleAppointments.filter((a) => a.status === 'pending' || a.status === 'confirmed').length;

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Termini</h1>
          <p className="mt-1 text-neutral-600">
            {formatDayLabel(date)}
            {date === today && ' (danas)'}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/panel/termini" method="get">
          {locations.length > 1 ? (
            <select name="lokacija" defaultValue={location.id} className="rounded-md border border-neutral-300 px-3 py-2">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="lokacija" value={location.id} />
          )}
          <input type="date" name="datum" defaultValue={date} className="rounded-md border border-neutral-300 px-3 py-2" />
          {bookableStaff.length > 1 && (
            <select name="radnik" defaultValue={staffFilter} className="rounded-md border border-neutral-300 px-3 py-2">
              <option value="">Svi zaposleni</option>
              {bookableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium">
            Prikaži
          </button>
        </form>
      </div>

      <div className="mt-4 flex gap-2 text-sm">
        <Link href={href(addDays(date, -1))} className="rounded-md border border-neutral-300 bg-white px-3 py-2">
          ← Prethodni
        </Link>
        <Link href={href(today)} className="rounded-md border border-neutral-300 bg-white px-3 py-2">
          Danas
        </Link>
        <Link href={href(addDays(date, 1))} className="rounded-md border border-neutral-300 bg-white px-3 py-2">
          Sledeći →
        </Link>
      </div>

      <p className="mt-4 text-sm text-neutral-600">
        {locations.length > 1 && `${location.name} · `}Aktivnih termina: {active}
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {columns.map((col) => (
          <section key={col.id}>
            <h2 className="font-medium">{col.name}</h2>
            {col.items.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
                Nema termina.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {col.items.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    timezone={location.timezone}
                    nowMs={nowMs}
                    showStaffName={showStaffName}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <details className="mt-8 rounded-lg border border-neutral-200 bg-white p-4" open={appointments.length === 0}>
        <summary className="cursor-pointer font-medium">Novi termin (telefonom ili lično)</summary>
        <p className="mt-1 text-sm text-neutral-600">Termin koji unese salon je odmah potvrđen.</p>
        <div className="mt-4">
          <NewAppointmentForm
            key={`${location.id}-${date}`}
            locationId={location.id}
            initialDate={date < today ? today : date}
            services={services}
            staff={bookableStaff}
            allowAnyStaff={allowAnyStaff}
          />
        </div>
      </details>
    </main>
  );
}

function AppointmentCard({
  appointment: a,
  timezone,
  nowMs,
  showStaffName,
}: {
  appointment: DayAppointment;
  timezone: string;
  nowMs: number;
  showStaffName: boolean;
}) {
  const inactive = a.status !== 'pending' && a.status !== 'confirmed';
  return (
    <li className={`rounded-lg border border-neutral-200 bg-white p-4 ${inactive ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-semibold tabular-nums">
          {formatTime(a.startsAt, timezone)}–{formatTime(a.endsAt, timezone)}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>
      <p className="mt-1">
        {showStaffName ? `kod ${a.staffName} · ` : ''}
        {a.serviceName} · {a.durationMin} min · {formatPrice(a.price)}
      </p>
      <p className="mt-2 font-medium">{a.clientName}</p>
      {a.clientPhone && (
        <a href={`tel:${a.clientPhone}`} className="text-sm text-neutral-700 underline">
          {a.clientPhone}
        </a>
      )}
      {a.clientNote && <p className="mt-1 text-sm text-neutral-600">Napomena: {a.clientNote}</p>}
      {a.enteredBySalon && <p className="mt-1 text-xs text-neutral-500">Uneo salon</p>}
      {a.status === 'pending' && (
        <p className="mt-2 text-sm text-amber-900">
          Gost još nije potvrdio emailom. Ako ne potvrdi u roku od sat vremena, termin se oslobađa.
        </p>
      )}
      <StatusActions appointmentId={a.id} actions={availableActions(a.status, a.startsAt.getTime(), nowMs)} />
    </li>
  );
}
