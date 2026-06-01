import { NextResponse } from 'next/server';
import { getWorkspaces, upsertWorkspace, deleteWorkspace } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workspaces = await getWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    if (['lottus', 'iota', 'splice'].includes(id)) {
      return NextResponse.json({ error: 'Não é possível excluir workspaces padrão' }, { status: 400 });
    }
    await deleteWorkspace(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
