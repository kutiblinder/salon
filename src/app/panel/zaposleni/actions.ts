'use server';

import { refresh } from 'next/cache';
import { runPanelAction, type ActionResult } from '@/lib/panel/context';
import { isUuid } from '@/lib/panel/schedule';
import {
  createStaff,
  createStaffLogin,
  parseDurationOverride,
  parseEmail,
  parseIdList,
  parseOptionalText,
  parseSortOrder,
  parseStaffName,
  updateStaff,
} from '@/lib/panel/staff';
import type { CreateLoginResult, StaffServiceAssignment } from '@/lib/panel/staff-types';

export type FormState = ActionResult<{ message: string; id?: string }> | null;
export type LoginFormState = ActionResult<CreateLoginResult> | null;

function parseServices(formData: FormData): StaffServiceAssignment[] | null {
  const ids = parseIdList(formData.getAll('serviceId'));
  if (!ids) return null;
  const services: StaffServiceAssignment[] = [];
  for (const serviceId of ids) {
    const duration = parseDurationOverride(formData.get(`duration_${serviceId}`));
    if (duration === undefined) return null;
    services.push({ serviceId, durationOverrideMin: duration });
  }
  return services;
}

type ParsedProfile =
  | { error: string }
  | {
      name: string;
      title: string | null;
      bio: string | null;
      sortOrder: number;
      locationIds: string[];
      services: StaffServiceAssignment[];
    };

function parseProfile(formData: FormData): ParsedProfile {
  const name = parseStaffName(formData.get('name'));
  const title = parseOptionalText(formData.get('title'), 80);
  const bio = parseOptionalText(formData.get('bio'), 500);
  const sortOrder = parseSortOrder(formData.get('sortOrder'));
  const locationIds = parseIdList(formData.getAll('locationId'));
  const services = parseServices(formData);
  if (!name) return { error: 'Unesite ime (do 80 karaktera).' };
  if (title === undefined) return { error: 'Titula je predugačka.' };
  if (bio === undefined) return { error: 'Opis je predugačak.' };
  if (sortOrder === null) return { error: 'Redosled mora biti nula ili pozitivan broj.' };
  if (!locationIds) return { error: 'Neispravan objekat.' };
  if (locationIds.length === 0) return { error: 'Izaberite bar jedan objekat.' };
  if (!services) return { error: 'Trajanje usluge mora biti ceo broj minuta, ili prazno.' };
  return { name, title, bio, sortOrder, locationIds, services };
}

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseProfile(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const result = await runPanelAction(async (client, ctx) =>
    createStaff(client, ctx, {
      name: parsed.name,
      title: parsed.title,
      bio: parsed.bio,
      sortOrder: parsed.sortOrder,
      locationIds: parsed.locationIds,
      services: parsed.services,
    }),
  );
  if (!result.ok) return result;
  return { ok: true, data: { message: 'Zaposleni je dodat.', id: result.data.id } };
}

export async function updateStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staffId = String(formData.get('staffId') ?? '');
  if (!isUuid(staffId)) return { ok: false, error: 'Neispravan zahtev.' };
  const parsed = parseProfile(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const result = await runPanelAction(async (client, ctx) => {
    await updateStaff(client, ctx, {
      staffId,
      name: parsed.name,
      title: parsed.title,
      bio: parsed.bio,
      isActive: formData.get('isActive') === 'on',
      sortOrder: parsed.sortOrder,
      locationIds: parsed.locationIds,
      services: parsed.services,
    });
    return { message: 'Profil je sačuvan.' };
  });
  if (result.ok) refresh();
  return result;
}

export async function createLoginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const staffId = String(formData.get('staffId') ?? '');
  const email = parseEmail(formData.get('email'));
  if (!isUuid(staffId) || !email) return { ok: false, error: 'Unesite ispravan email.' };
  const rawPassword = formData.get('password');
  let password: string | null = null;
  if (typeof rawPassword === 'string' && rawPassword.length > 0) {
    if (rawPassword.length < 8 || rawPassword.length > 72) {
      return { ok: false, error: 'Lozinka mora imati između 8 i 72 znaka, ili ostavite prazno.' };
    }
    password = rawPassword;
  }

  return runPanelAction(async (client, ctx) => createStaffLogin(client, ctx, { staffId, email, password }));
}
