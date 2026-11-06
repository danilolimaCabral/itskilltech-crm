import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWorkspaces, hasDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession(request);
  const allWorkspaces = await getWorkspaces();
  if (!session) {
    const publicWorkspace = allWorkspaces.find((workspace: any) => workspace.id === 'lottus');
    return NextResponse.json({
      session: { username: 'public', display_name: 'Acesso público', role: 'public', workspace: 'lottus' },
      workspaces: publicWorkspace ? [{ id: publicWorkspace.id, name: publicWorkspace.name, color: publicWorkspace.color || '#0066ff' }] : [],
      hasDatabase,
      publicAccess: true,
    });
  }
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
    hasDatabase,
  });
}
