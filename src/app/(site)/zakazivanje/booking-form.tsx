'use client';

import { useMemo, useState } from 'react';
import type { BookingCatalog } from '@/lib/site/types';
import { formatPrice } from '@/lib/panel/format';
import { DateCalendar } from './date-calendar';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';
const btnClass = 'min-h-11 rounded-md border border-neutral-300 px-3 text-sm';

type Slot = { start: string; staffIds: string[] };

export function BookingForm({
  catalog,
  initialLocationId,
  initialServiceId,
  guestConfirmEmail,
  client,
}: {
  catalog: BookingCatalog;
  initialLocationId?: string;
  initialServiceId?: string;
  guestConfirmEmail: boolean;
  client: { name: string; email: string; phone: string | null } | null;
}) {
  const defaultLoc =
    catalog.locations.find((l) => l.id === initialLocationId)?.id ??
    (catalog.locations.length === 1 ? catalog.locations[0].id : '');
  const [locationId, setLocationId] = useState(defaultLoc);
  const [serviceId, setServiceId] = useState(initialServiceId && defaultLoc ? initialServiceId : '');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotStart, setSlotStart] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; manageUrl?: string } | null>(null);

  const offers = useMemo(
    () => catalog.offers.filter((o) => o.locationId === locationId),
    [catalog.offers, locationId],
  );
  const staff = useMemo(
    () =>
      catalog.staff.filter((s) => s.locationId === locationId && s.serviceId === serviceId).filter(
        (s, i, all) => all.findIndex((x) => x.id === s.id) === i,
      ),
    [catalog.staff, locationId, serviceId],
  );
  const offer = offers.find((o) => o.serviceId === serviceId);

  async function loadSlots(nextDate: string, nextStaffId = staffId) {
    if (!locationId || !serviceId || !nextDate) return;
    setLoading(true);
    setError(null);
    setSlots(null);
    setSlotStart('');
    try {
      const params = new URLSearchParams({ locationId, serviceId, date: nextDate });
      if (nextStaffId) params.set('staffId', nextStaffId);
      const res = await fetch(`/api/availability?${params}`);
      const data = (await res.json()) as { slots?: Slot[]; error?: string };
      if (!res.ok) {
        setError('Nije moguće učitati termine. Pokušajte ponovo.');
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setError('Nema veze sa serverom.');
    } finally {
      setLoading(false);
    }
  }

  async function submit(form: FormData) {
    if (!locationId || !serviceId || !slotStart) {
      setError('Izaberite lokaciju, uslugu i termin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        locationId,
        serviceId,
        staffId: staffId || null,
        start: slotStart,
        note: String(form.get('note') ?? '') || undefined,
        guest: {
          name: form.get('name'),
          phone: form.get('phone'),
          email: client ? client.email : form.get('email'),
        },
      };
      if (!client) {
        body.privacyConsent = form.get('privacyConsent') === 'on';
      }
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        appointment?: { status: string };
        devManageUrl?: string;
      };
      if (!res.ok) {
        setError(data.message ?? 'Zakazivanje nije uspelo. Izaberite drugi termin.');
        return;
      }
      setDone({
        message:
          data.appointment?.status === 'pending' || guestConfirmEmail
            ? 'Termin je rezervisan. Potvrdite ga linkom koji stiže na email (u razvoju je u konzoli servera). Ako ne potvrdite u roku od sat vremena, termin se oslobađa.'
            : 'Termin je zakazan.',
        manageUrl: data.devManageUrl,
      });
    } catch {
      setError('Nema veze sa serverom.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-medium text-emerald-950">{done.message}</p>
        {done.manageUrl && (
          <p className="mt-2 text-sm">
            <a href={done.manageUrl} className="underline">
              Otvori stranicu termina
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      {catalog.locations.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium">Objekat</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {catalog.locations.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`${btnClass} ${l.id === locationId ? 'bg-neutral-900 text-white' : ''}`}
                onClick={() => {
                  setLocationId(l.id);
                  setServiceId('');
                  setStaffId('');
                  setSlots(null);
                  setSlotStart('');
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {locationId && (
        <fieldset>
          <legend className="text-sm font-medium">Usluga</legend>
          <ul className="mt-2 space-y-2">
            {offers.map((o) => (
              <li key={o.serviceId}>
                <button
                  type="button"
                  className={`w-full rounded-md border px-3 py-3 text-left ${
                    o.serviceId === serviceId ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                  }`}
                  onClick={() => {
                    setServiceId(o.serviceId);
                    setStaffId('');
                    setSlots(null);
                    setSlotStart('');
                  }}
                >
                  <span className="font-medium">{o.name}</span>
                  <span className="mt-0.5 block text-sm text-neutral-600">
                    {o.durationMin} min · {formatPrice(o.price, o.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {offer && (
        <fieldset>
          <legend className="text-sm font-medium">Radnik</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`${btnClass} ${staffId === '' ? 'bg-neutral-900 text-white' : ''}`}
              onClick={() => {
                setStaffId('');
                if (date) loadSlots(date, '');
              }}
            >
              Bilo koji
            </button>
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${btnClass} ${staffId === s.id ? 'bg-neutral-900 text-white' : ''}`}
                onClick={() => {
                  setStaffId(s.id);
                  if (date) {
                    setStaffId(s.id);
                    // load after state: pass staff in query below via effect-less call
                    const params = new URLSearchParams({ locationId, serviceId, date, staffId: s.id });
                    setLoading(true);
                    fetch(`/api/availability?${params}`)
                      .then((r) => r.json())
                      .then((d) => {
                        setSlots(d.slots ?? []);
                        setSlotStart('');
                      })
                      .finally(() => setLoading(false));
                  }
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {offer && (
        <DateCalendar
          key={`${locationId}-${serviceId}-${staffId}`}
          locationId={locationId}
          serviceId={serviceId}
          staffId={staffId}
          value={date}
          onChange={(next) => {
            setDate(next);
            if (next) loadSlots(next);
            else {
              setSlots(null);
              setSlotStart('');
            }
          }}
        />
      )}

      {loading && <p className="text-sm text-neutral-600">Učitavanje…</p>}
      {slots && slots.length === 0 && <p className="text-sm text-neutral-600">Nema slobodnih termina tog dana.</p>}
      {slots && slots.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">Termin</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((s) => {
              const time = new Date(s.start).toLocaleTimeString('sr-Latn-RS', {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              });
              return (
                <button
                  key={s.start}
                  type="button"
                  className={`${btnClass} ${slotStart === s.start ? 'bg-neutral-900 text-white' : ''}`}
                  onClick={() => setSlotStart(s.start)}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {slotStart && (
        <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
          {client ? (
            <p className="text-sm text-neutral-700">
              Zakazujete kao {client.email}. Termin je odmah potvrđen. Ime i telefon su sa vašeg naloga.
            </p>
          ) : (
            <p className="text-sm text-neutral-700">
              Možete zakazati bez naloga. Unesite ime, telefon i email.{' '}
              <a href="/prijava" className="underline">
                Prijavite se
              </a>{' '}
              da se podaci popune sami.
            </p>
          )}
          <label className="block text-sm font-medium">
            Ime i prezime
            <input
              name="name"
              className={inputClass}
              required
              maxLength={100}
              autoComplete="name"
              defaultValue={client?.name ?? ''}
            />
          </label>
          <label className="block text-sm font-medium">
            Telefon
            <input
              name="phone"
              className={inputClass}
              required
              inputMode="tel"
              autoComplete="tel"
              defaultValue={client?.phone ?? ''}
            />
          </label>
          {!client && (
            <>
              <label className="block text-sm font-medium">
                Email
                <input name="email" type="email" className={inputClass} required autoComplete="email" />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="privacyConsent" className="mt-1 size-4" required />
                <span>
                  Slažem se sa{' '}
                  <a href="/privatnost" className="underline">
                    politikom privatnosti
                  </a>{' '}
                  (obrada podataka radi zakazivanja).
                </span>
              </label>
            </>
          )}
          <label className="block text-sm font-medium">
            Napomena (opciono)
            <input name="note" className={inputClass} maxLength={500} />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-md bg-neutral-900 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Slanje…' : 'Zakaži'}
          </button>
        </section>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
