import { NextResponse } from 'next/server';
import { listConnectedWorkspaces, removeAccount } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

const WORKSPACES = ['lottus', 'iota', 'splice'];

// GET /api/accounts → status de conexão de cada workspace
export async function GET() {
  const accounts = listConnectedWorkspaces(WORKSPACES);
  const configured = !!process.env.GOOGLE_CLIENT_ID;
  return NextResponse.json({ configured, accounts });
}

// DELETE /api/accounts?workspace=lottus → desconecta a conta
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace');
  if (workspace) removeAccount(workspace);
  return NextResponse.json({ ok: true });
}
