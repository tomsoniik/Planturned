import { NextResponse } from 'next/server';
import { STATE_COOKIE, authConfig, cookieBase, newState } from '@/lib/cms/auth';

/** Start logowania: przekierowanie do GitHuba z losowym state w ciasteczku (ochrona przed CSRF). */
export async function GET(request: Request) {
  const cfg = authConfig();
  const origin = new URL(request.url).origin;
  if (!cfg) return NextResponse.redirect(`${origin}/admin?error=config`);

  const state = newState();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', cfg.clientId);
  authorize.searchParams.set('redirect_uri', `${origin}/api/auth/github/callback`);
  authorize.searchParams.set('state', state);
  // Bez scope: wystarczy publiczny profil, żeby poznać login
  authorize.searchParams.set('allow_signup', 'false');

  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, state, { ...cookieBase, maxAge: 600 });
  return res;
}
