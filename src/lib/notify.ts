export interface GuestBookingEmail {
  to: string;
  salonName: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  timezone: string;
  manageUrl: string;
  pendingTtlMin: number;
}

export function formatLocalDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: timezone, dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/**
 * Email gostu sa linkom za potvrdu/otkazivanje termina.
 * Email provajder (Resend/Postmark) jos nije izabran: u razvoju se poruka ispisuje u konzolu.
 */
export async function sendGuestBookingEmail(msg: GuestBookingEmail): Promise<void> {
  const when = formatLocalDateTime(msg.startsAt, msg.timezone);
  if (process.env.NODE_ENV === 'production') {
    // Link se ne loguje u produkciji: ko ima token, upravlja terminom.
    console.warn(`[notify] Email provider not configured; booking email to ${msg.to} not sent.`);
    return;
  }
  console.info(
    [
      '[notify] (dev) Email gostu',
      `  Za: ${msg.to}`,
      `  ${msg.salonName}: ${msg.serviceName} kod ${msg.staffName}, ${when}`,
      `  Potvrdi u roku od ${msg.pendingTtlMin} min: ${msg.manageUrl}`,
    ].join('\n'),
  );
}
