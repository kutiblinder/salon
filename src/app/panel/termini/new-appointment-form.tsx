'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import type { LocationService, LocationStaff } from '@/lib/panel/appointments';
import { bookAppointment, loadPanelSlots, type BookingFormState, type SlotOption } from './actions';

interface Props {
  locationId: string;
  initialDate: string;
  services: LocationService[];
  staff: LocationStaff[];
  /** Dozvoljen izbor "bilo koji radnik" (nalog ima dozvolu nad celom lokacijom) */
  allowAnyStaff: boolean;
}

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function NewAppointmentForm({ locationId, initialDate, services, staff, allowAnyStaff }: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [staffId, setStaffId] = useState(allowAnyStaff ? '' : (staff[0]?.id ?? ''));
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(bookAppointment, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setSlots(null);
    setSlotsError(null);
    loadPanelSlots(locationId, serviceId, staffId || null, date).then((result) => {
      if (cancelled) return;
      if (result.ok) setSlots(result.data);
      else setSlotsError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId, serviceId, staffId, date, state]);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.querySelectorAll<HTMLInputElement>('input[data-reset]').forEach((input) => {
        input.value = '';
      });
    }
  }, [state]);

  if (services.length === 0 || staff.length === 0) {
    return <p className="text-sm text-neutral-600">Na ovoj lokaciji još nema usluga ili zaposlenih.</p>;
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        // Rucno slanje: automatski reset forme bi obrisao unos i kad zakazivanje ne uspe
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="locationId" value={locationId} />

      <label className="block text-sm font-medium">
        Usluga
        <select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={inputClass}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMin} min)
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Radnik
        <select name="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}>
          {allowAnyStaff && <option value="">Bilo ko slobodan</option>}
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Datum
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
      </label>

      <label className="block text-sm font-medium">
        Vreme
        <select name="start" className={inputClass} required disabled={!slots || slots.length === 0}>
          {slots === null && !slotsError && <option>Učitavanje…</option>}
          {slots?.length === 0 && <option value="">Nema slobodnih termina</option>}
          {slots?.map((s) => (
            <option key={s.start} value={s.start}>
              {s.label}
            </option>
          ))}
        </select>
        {slotsError && <span className="mt-1 block text-sm text-rose-700">{slotsError}</span>}
      </label>

      <label className="block text-sm font-medium">
        Ime i prezime klijenta
        <input name="name" data-reset className={inputClass} required maxLength={100} autoComplete="off" />
      </label>

      <label className="block text-sm font-medium">
        Telefon
        <input name="phone" data-reset type="tel" className={inputClass} required autoComplete="off" placeholder="06x xxx xxxx" />
      </label>

      <label className="block text-sm font-medium">
        Email (opciono)
        <input name="email" data-reset type="email" className={inputClass} autoComplete="off" />
      </label>

      <label className="block text-sm font-medium">
        Napomena (opciono)
        <input name="note" data-reset className={inputClass} maxLength={500} autoComplete="off" />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending || !slots || slots.length === 0}
          className="min-h-11 w-full rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50 sm:w-auto"
        >
          {pending ? 'Zakazivanje…' : 'Zakaži termin'}
        </button>
        {state && !state.ok && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}
        {state?.ok && <p className="mt-2 text-sm text-emerald-700">{state.data.message}</p>}
      </div>
    </form>
  );
}
