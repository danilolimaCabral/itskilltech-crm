import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SESSION_COOKIE = 'crm_session';
const SESSION_VALUE = 'danilo_getlog2026_authenticated';

// Rotas que NÃO precisam de autenticação
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/cron',
  '/_next',
  '/favicon.ico',
  '/public',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Liberar rotas públicas
  const isPublic = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  // Verificar cookie de sessão
  const session = request.cookies.get(SESSION_COOKIE);
  if (session?.value === SESSION_VALUE) {
    return NextResponse.next();
  }

  // Redirecionar para login
  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
