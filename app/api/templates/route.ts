import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, upsertTemplate, deleteTemplate } from '@/lib/db';

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace') || 'lottus';
  const templates = await getTemplates(workspace);
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const t = {
    id: body.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspace: body.workspace || 'lottus',
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
  const { id } = await req.json();
  await deleteTemplate(id);
  return NextResponse.json({ ok: true });
}
