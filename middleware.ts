import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOGIN_PATH = '/login';
const SESSION_COOKIE = 'crm_session';

// Rotas que NÃO precisam de autenticação
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/recover',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/me',
  '/_next',
  '/favicon.ico',
  '/public',
];

// Acesso anônimo limitado a dados de CRM; integrações, envios e custos ficam privados.
const PUBLIC_DATA_METHODS: Record<string, readonly string[]> = {
  '/api/leads': ['GET', 'POST', 'DELETE'],
  '/api/quotes': ['GET', 'POST', 'DELETE'],
  '/api/get-real-activities': ['GET'],
  '/api/stats': ['GET'],
};

function isPublicDataRequest(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === '/api/prospect') {
    if (request.method === 'GET') return searchParams.get('health') === '1';
    return false;
  }
  return PUBLIC_DATA_METHODS[pathname]?.includes(request.method.toUpperCase()) ?? false;
}

function isPublicAppPage(pathname: string) {
  return pathname === '/';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cronSecret = process.env.CRON_SECRET || '';
  const authorization = request.headers.get('authorization') || '';
  const isCronEndpoint = pathname === '/api/cron/followup' || pathname === '/api/cron/prospect';
  if (isCronEndpoint) {
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }
  if (pathname === '/api/auto-prospect' && request.method === 'POST' && cronSecret && authorization === `Bearer ${cronSecret}`) {
    return NextResponse.next();
  }

  // Acesso temporário somente para testes em Preview/Development.
  // Nunca libera a rota em produção e exige uma chave enviada no header.
  const isNonProduction = process.env.VERCEL_ENV !== 'production';
  const testKey = process.env.APOLLO_TEST_KEY || '';
  const hasValidApolloTestKey = isNonProduction && testKey && request.headers.get('x-apollo-test-key') === testKey;
  if (pathname === '/api/prospect' && hasValidApolloTestKey) {
    return NextResponse.next();
  }

  // Liberar rotas públicas
  const isPublic = PUBLIC_PATHS.some(path => pathname === path)
    || pathname.startsWith('/_next/')
    || pathname.startsWith('/public/');
  if (isPublic) {
    return NextResponse.next();
  }

  if (isPublicAppPage(pathname) || isPublicDataRequest(request)) {
    return NextResponse.next();
  }

  // O endpoint Node valida o token no banco. Falhas fecham o acesso.
  const session = request.cookies.get(SESSION_COOKIE);
  if (session?.value) {
    try {
      const validationUrl = new URL('/api/auth/me', request.url);
      const validationResponse = await fetch(validationUrl, {
        headers: { cookie: request.headers.get('cookie') || '' },
        cache: 'no-store',
      });
      if (validationResponse.ok) {
        const validation = await validationResponse.json();
        if (validation.session && validation.session.role !== 'public') {
          return NextResponse.next();
        }
      }
    } catch {
      // Falha fechada: não liberar endpoints privados se a validação estiver indisponível.
    }
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
