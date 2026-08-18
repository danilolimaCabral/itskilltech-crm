import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserByUsername, initDatabase } from '@/lib/db';
import { sessionCookie, startSession, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    await initDatabase();
    const user = await getTenantUserByUsername(username);

    if (user && user.active && verifyPassword(password, user.password_hash)) {
      const { token, session } = await startSession({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role === 'master' ? 'master' : 'operator',
        workspace: user.workspace,
      });
      const response = NextResponse.json({ success: true, session: { username: session.username, display_name: session.display_name, workspace: session.workspace, role: session.role } });
      const cookie = sessionCookie(token);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
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
