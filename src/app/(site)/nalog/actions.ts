'use server';

import { headers } from 'next/headers';
import { refresh } from 'next/cache';
import { withTenant } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/session';
import { cancelClientAppointment } from '@/lib/site/account';

export async function cancelMyAppointment(formData: FormData): Promise<void> {
  const session = await getCurrentSession(await headers());
  if (!session || session.realm.kind !== 'salon') return;
  const organizationId = session.realm.organizationId;
  const id = String(formData.get('id') ?? '');
  await withTenant(organizationId, (client) =>
    cancelClientAppointment(client, organizationId, session.user.id, id),
  );
  refresh();
}
