import { NextResponse } from 'next/server';
import { getQuotes, upsertQuote, deleteQuote } from '@/lib/db';
export const dynamic = 'force-dynamic';

const uid = () => 'qt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get('workspace');
    if (!workspace) return NextResponse.json({ error: 'workspace obrigatório' }, { status: 400 });
    const quotes = await getQuotes(workspace);
    return NextResponse.json({ quotes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const now = Date.now();
    const quote = {
      id: body.id || uid(),
      workspace: body.workspace,
      lead_id: body.lead_id || null,
      lead_name: body.lead_name || '',
      lead_company: body.lead_company || '',
      lead_email: body.lead_email || '',
      lead_phone: body.lead_phone || '',
      items: body.items || [],
      subtotal: body.subtotal || 0,
      discount: body.discount || 0,
      total: body.total || 0,
      notes: body.notes || '',
      status: body.status || 'rascunho',
      sent_at: body.sent_at || null,
      attachment_url: body.attachment_url || '',
      created_at: body.created_at || now,
      updated_at: now,
    };
    await upsertQuote(quote);
    return NextResponse.json({ ok: true, quote });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    await deleteQuote(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
