import { NextResponse } from 'next/server';
import { getWorkspaces, upsertWorkspace, deleteWorkspace } from '@/lib/db';
import { getSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    const allWorkspaces = await getWorkspaces();
    const workspaces = session.role === 'master' ? allWorkspaces : allWorkspaces.filter((workspace: any) => workspace.id === session.workspace);
    return NextResponse.json({ workspaces });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'master') return NextResponse.json({ error: 'Acesso restrito ao administrador mestre.' }, { status: 403 });
    const ws = await req.json();
    if (!ws.id || !ws.name) return NextResponse.json({ error: 'id e name são obrigatórios' }, { status: 400 });
    await upsertWorkspace(ws);
    return NextResponse.json({ ok: true, workspace: ws });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'master') return NextResponse.json({ error: 'Acesso restrito ao administrador mestre.' }, { status: 403 });
    const ws = await req.json();
    if (!ws.id || !ws.name) return NextResponse.json({ error: 'id e name são obrigatórios' }, { status: 400 });
    await upsertWorkspace(ws);
    return NextResponse.json({ ok: true, workspace: ws });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession(req);
    if (session?.role !== 'master') return NextResponse.json({ error: 'Acesso restrito ao administrador mestre.' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    if (['lottus', 'iota', 'splitc'].includes(id)) {
      return NextResponse.json({ error: 'Não é possível excluir workspaces padrão' }, { status: 400 });
    }
    await deleteWorkspace(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
