import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, upsertTemplate, deleteTemplate } from '@/lib/db';
import { resolveWorkspace } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const access = await resolveWorkspace(req, req.nextUrl.searchParams.get('workspace'));
  if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
  const workspace = access.workspace;
  const templates = await getTemplates(workspace);
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const access = await resolveWorkspace(req, body.workspace);
  if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
  const t = {
    id: body.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspace: access.workspace,
    name: body.name || 'Novo template',
    type: body.type || 'whatsapp', // 'whatsapp' | 'email'
    subject: body.subject || '',
    body: body.body || '',
    tags: body.tags || '',
    created_at: body.created_at || Date.now(),
    updated_at: Date.now(),
  };
  await upsertTemplate(t);
  return NextResponse.json(t);
}

export async function DELETE(req: NextRequest) {
  const { id, workspace: requestedWorkspace } = await req.json();
  const access = await resolveWorkspace(req, requestedWorkspace);
  if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
  await deleteTemplate(id, access.workspace);
  return NextResponse.json({ ok: true });
}
