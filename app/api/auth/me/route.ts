import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWorkspaces } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
  const allWorkspaces = await getWorkspaces();
  const workspaces = session.role === 'master'
    ? allWorkspaces
    : allWorkspaces.filter((workspace: any) => workspace.id === session.workspace);
  return NextResponse.json({
    session: {
      username: session.username,
      display_name: session.display_name,
      role: session.role,
      workspace: session.workspace,
    },
    workspaces,
  });
}
