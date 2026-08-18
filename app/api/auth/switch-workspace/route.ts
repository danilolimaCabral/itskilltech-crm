import { NextResponse } from 'next/server';
import { getSession, sessionCookie, startSession } from '@/lib/auth';
import { getWorkspace } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  if (session.role !== 'master') return NextResponse.json({ error: 'Somente o administrador mestre pode trocar de empresa.' }, { status: 403 });
  const body = await request.json();
  const workspace = String(body.workspace || '').trim();
  const target = await getWorkspace(workspace);
  if (!target) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  const { token, session: nextSession } = await startSession({
    id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    role: 'master',
    workspace,
  });
  const response = NextResponse.json({ ok: true, workspace, session: nextSession });
  const cookie = sessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
