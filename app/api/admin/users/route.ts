import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { getTenantUserByUsername, getWorkspace, insertTenantUser, listTenantUsers } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function requireMaster(request: Request) {
  const session = await getSession(request);
  return session?.role === 'master' ? session : null;
}

export async function GET(request: Request) {
  if (!await requireMaster(request)) return NextResponse.json({ error: 'Acesso restrito ao administrador mestre.' }, { status: 403 });
  return NextResponse.json({ users: await listTenantUsers() });
}

export async function POST(request: Request) {
  if (!await requireMaster(request)) return NextResponse.json({ error: 'Acesso restrito ao administrador mestre.' }, { status: 403 });
  const body = await request.json();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.display_name || '').trim() || username;
  const workspace = String(body.workspace || '').trim();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: 'Usuário deve ter entre 3 e 40 caracteres: letras, números, ponto, hífen ou sublinhado.' }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: 'A senha temporária deve ter ao menos 10 caracteres.' }, { status: 400 });
  if (!await getWorkspace(workspace)) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 400 });
  if (await getTenantUserByUsername(username)) return NextResponse.json({ error: 'Este usuário já existe.' }, { status: 409 });
  const user = {
    id: `usr_${crypto.randomUUID()}`,
    username,
    password_hash: hashPassword(password),
    display_name: displayName,
    workspace,
    role: 'operator',
    active: true,
    created_at: Date.now(),
  };
  await insertTenantUser(user);
  return NextResponse.json({ ok: true, user: { id: user.id, username, display_name: displayName, workspace, role: 'operator' } });
}
