import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, STATE_COOKIE, authConfig, cookieBase, createSessionValue } from '@/lib/cms/auth';

/** Powrót z GitHuba: sprawdza state, wymienia code na token, czyta login i wpuszcza tylko admina. */
export async function GET(request: NextRequest) {
  const cfg = authConfig();
  const url = new URL(request.url);
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${url.origin}/admin?error=${reason}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  if (!cfg) return fail('config');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== request.cookies.get(STATE_COOKIE)?.value) return fail('state');

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: `${url.origin}/api/auth/github/callback`,
    }),
    cache: 'no-store',
  });
  const token = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!token?.access_token) return fail('github');

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'untmatica-admin' },
    cache: 'no-store',
  });
  const user = (await userRes.json().catch(() => null)) as { login?: string } | null;
  if (!user?.login) return fail('github');
  if (user.login.toLowerCase() !== cfg.adminLogin) return fail('denied');

  const session = createSessionValue(user.login, cfg.secret);
  const res = NextResponse.redirect(`${url.origin}/admin`);
  res.cookies.delete(STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, session.value, { ...cookieBase, maxAge: session.maxAge });
  return res;
}
