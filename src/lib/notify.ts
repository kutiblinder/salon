export interface GuestBookingEmail {
  to: string;
  salonName: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  timezone: string;
  manageUrl: string;
  requiresConfirm?: boolean;
}

export function formatLocalDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: timezone, dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

async function deliverEmail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Salon <noreply@localhost>';
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[notify] RESEND_API_KEY nije postavljen; email za ${to} nije poslat.`);
      return;
    }
    console.info(['[notify] (dev) Email', `  Za: ${to}`, `  ${subject}`, text].join('\n'));
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

/**
 * Email gostu: potvrda+otkaz ako salon traži potvrdu, inače samo otkaz.
 * Kad je RESEND_API_KEY postavljen, šalje preko Resend API-ja (bez SDK-a).
 */
export async function sendGuestBookingEmail(msg: GuestBookingEmail): Promise<void> {
  const when = formatLocalDateTime(msg.startsAt, msg.timezone);
  const action = msg.requiresConfirm
    ? `Potvrdite u roku od 60 min (inače se termin oslobađa) ili otkažite: ${msg.manageUrl}`
    : `Termin je zakazan. Otkažite: ${msg.manageUrl}`;
  const text = [`${msg.salonName}: ${msg.serviceName} kod ${msg.staffName}, ${when}.`, action].join('\n');
  await deliverEmail(msg.to, `Termin u ${msg.salonName}`, text);
}
