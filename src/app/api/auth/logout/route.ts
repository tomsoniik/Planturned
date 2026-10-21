import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/cms/auth';

/** Wylogowanie: tylko POST (formularz w panelu), żeby link nie wylogowywał przez przypadek. */
export async function POST(request: Request) {
  const res = NextResponse.redirect(`${new URL(request.url).origin}/admin`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
