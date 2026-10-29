import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { kyselyAdapter } from '@better-auth/kysely-adapter';
import { Kysely, PostgresDialect } from 'kysely';
import { normalizePhone } from '../appointments/validate';
import { getPool } from '../db';
import { realmScopedAdapter } from './adapter';
import { invalidateAuthCache } from './cache';
import { currentRealm } from './realm';

declare global {
  // Jedna instanca izmedju hot-reload-a u razvoju
  var __salonAuth: ReturnType<typeof createAuth> | undefined;
  var __salonAuthHostsKey: string | undefined;
}

let extraHosts: string[] = [];

export { invalidateAuthCache };

/** Učitava proverene custom domene u allowedHosts (prijava na frizer.rs). */
export async function refreshCustomAuthHosts(): Promise<void> {
  const res = await getPool().query<{ domain: string }>(
    `SELECT domain FROM organization_domains WHERE verified_at IS NOT NULL ORDER BY domain`,
  );
  const hosts = res.rows.map((r) => r.domain);
  const key = hosts.join(',');
  extraHosts = hosts;
  if (globalThis.__salonAuthHostsKey === key) return;
  globalThis.__salonAuthHostsKey = key;
  globalThis.__salonAuth = undefined;
}

const timestamps = { createdAt: 'created_at', updatedAt: 'updated_at' } as const;
const scope = { type: 'string', required: false, input: false, fieldName: 'organization_id' } as const;

function createAuth() {
  const db = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: getPool() }) });
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    // Domeni salona se dodaju dinamicki; dozvoljen je samo origin istog domena (vidi trustedOrigins)
    baseURL: {
      allowedHosts: authAllowedHosts(),
      protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http',
    },
    trustedOrigins: (request) => (request ? [new URL(request.url).origin] : []),
    database: realmScopedAdapter(kyselyAdapter(db, { type: 'postgres', transaction: true })),
    advanced: {
      cookiePrefix: 'salon',
      database: { generateId: 'uuid' },
      trustedProxyHeaders: process.env.NODE_ENV === 'production',
    },
    emailAndPassword: {
      enabled: true,
      // Email provajder jos nije izabran: bez potvrde emaila za sada
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: 8,
    },
    user: {
      modelName: 'users',
      fields: { name: 'full_name', emailVerified: 'email_verified', ...timestamps },
      additionalFields: {
        organizationId: scope,
        phone: { type: 'string', required: false, input: true },
        privacyConsentAt: { type: 'date', required: false, input: false, fieldName: 'privacy_consent_at' },
      },
    },
    session: {
      modelName: 'sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        ...timestamps,
      },
      additionalFields: {
        organizationId: scope,
        activeOrganizationId: { type: 'string', required: false, input: false, fieldName: 'active_organization_id' },
      },
    },
    account: {
      modelName: 'accounts',
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        ...timestamps,
      },
      additionalFields: { organizationId: scope },
    },
    verification: {
      modelName: 'verifications',
      fields: { expiresAt: 'expires_at', ...timestamps },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') return;
        // Na domenu platforme nema javne registracije (nalog admina pravi skripta)
        if (currentRealm().kind === 'platform') {
          throw new APIError('FORBIDDEN', { message: 'Registracija nije dozvoljena na ovom domenu.' });
        }
        const body = (ctx.body ?? {}) as { privacyConsent?: unknown; phone?: unknown };
        if (body.privacyConsent !== true) {
          throw new APIError('BAD_REQUEST', { code: 'CONSENT_REQUIRED', message: 'Potrebna je saglasnost sa politikom privatnosti.' });
        }
        const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
        if (!phone) throw new APIError('BAD_REQUEST', { code: 'INVALID_PHONE', message: 'Neispravan broj telefona.' });
        return { context: { body: { ...body, phone } } };
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, privacyConsentAt: new Date() } }),
        },
      },
    },
  });
}

/** Domen platforme, subdomeni salona i provereni custom domeni (sa portom u razvoju). */
function authAllowedHosts(): string[] {
  const base = process.env.BASE_DOMAIN ?? 'localhost';
  const hosts = [base, `*.${base}`, `${base}:*`, `*.${base}:*`, ...extraHosts];
  for (const d of extraHosts) hosts.push(`${d}:*`);
  return hosts;
}

export function getAuth() {
  return (globalThis.__salonAuth ??= createAuth());
}
