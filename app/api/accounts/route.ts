import { NextResponse } from 'next/server';
import { listConnectedWorkspaces, removeAccount } from '@/lib/accounts';
import { getSession, resolveWorkspace } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/accounts → status de conexão de cada workspace
export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  const allowedWorkspaces = session.role === 'master' ? ['lottus', 'iota', 'splitc'] : [session.workspace];
  const accounts = listConnectedWorkspaces(allowedWorkspaces);
  const configured = !!process.env.GOOGLE_CLIENT_ID;
  return NextResponse.json({ configured, accounts });
}

// DELETE /api/accounts?workspace=lottus → desconecta a conta
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const access = await resolveWorkspace(req, searchParams.get('workspace'));
  if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
  removeAccount(access.workspace);
  return NextResponse.json({ ok: true });
}
