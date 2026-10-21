import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/*
  Logowanie admina przez GitHub OAuth, bez bibliotek.
  Sesja: ciasteczko httpOnly "login.wygaśnięcie.podpis" (HMAC-SHA256 kluczem AUTH_SECRET).
  Wpuszczamy tylko login z ADMIN_GITHUB_LOGIN.
*/
export const SESSION_COOKIE = 'untmatica_admin';
export const STATE_COOKIE = 'untmatica_oauth_state';
const SESSION_DAYS = 7;

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  secret: string;
  adminLogin: string;
}

/** null, gdy brakuje którejś zmiennej: panel pokaże wtedy instrukcję zamiast logowania. */
export function authConfig(): AuthConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const secret = process.env.AUTH_SECRET;
  const adminLogin = process.env.ADMIN_GITHUB_LOGIN;
  if (!clientId || !clientSecret || !secret || secret.length < 32 || !adminLogin) return null;
  return { clientId, clientSecret, secret, adminLogin: adminLogin.toLowerCase() };
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function createSessionValue(login: string, secret: string) {
  const payload = `${login.toLowerCase()}.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return { value: `${payload}.${sign(payload, secret)}`, maxAge: SESSION_DAYS * 86_400 };
}

function verifySession(value: string | undefined, cfg: AuthConfig): string | null {
  if (!value) return null;
  const i = value.lastIndexOf('.');
  if (i < 0) return null;
  const payload = value.slice(0, i);
  const expected = Buffer.from(sign(payload, cfg.secret));
  const given = Buffer.from(value.slice(i + 1));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [login, exp] = payload.split('.');
  if (!login || Number(exp) < Date.now()) return null;
  // Zmiana ADMIN_GITHUB_LOGIN unieważnia stare sesje
  return login === cfg.adminLogin ? login : null;
}

/** Login zalogowanego admina albo null. */
export async function getAdmin(): Promise<string | null> {
  const cfg = authConfig();
  if (!cfg) return null;
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, cfg);
}

/** Do każdej server action: rzuca, gdy żądanie nie jest od admina. */
export async function requireAdmin(): Promise<string> {
  const login = await getAdmin();
  if (!login) throw new Error('Brak uprawnień');
  return login;
}

export const newState = () => randomBytes(24).toString('base64url');

export const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
