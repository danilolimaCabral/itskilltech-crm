import { NextRequest, NextResponse } from 'next/server';

const VALID_USER = 'danilo';
const VALID_PASS = 'getlog2026';
const SESSION_COOKIE = 'crm_session';
const SESSION_VALUE = 'danilo_getlog2026_authenticated';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (username === VALID_USER && password === VALID_PASS) {
      const response = NextResponse.json({ success: true });
      
      // Setar cookie de sessão (30 dias)
      response.cookies.set(SESSION_COOKIE, SESSION_VALUE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: '/',
      });
      
      return response;
    }

    return NextResponse.json(
      { success: false, message: 'Usuário ou senha incorretos.' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: 'Erro interno.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('crm_session');
  return response;
}
