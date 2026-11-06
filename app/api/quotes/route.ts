import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getQuotes, upsertQuote, deleteQuote } from '@/lib/db';
import { resolvePublicWorkspace, resolveWorkspace } from '@/lib/auth';
export const dynamic = 'force-dynamic';

const uid = () => 'qt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const access = await resolvePublicWorkspace(req, searchParams.get('workspace'));
    if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
    const workspace = access.workspace;
    const quotes = await getQuotes(workspace);
    return NextResponse.json({ quotes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const access = await resolvePublicWorkspace(req, body.workspace);
    if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
    const now = Date.now();
    const quoteId = String(body.id || uid());
    const { rows: idOwners } = await sql`SELECT workspace FROM quotes WHERE id = ${quoteId} LIMIT 1;`;
    if (idOwners.length > 0 && idOwners[0].workspace !== access.workspace) {
      return NextResponse.json({ error: 'ID já pertence a outro workspace.' }, { status: 409 });
    }
    const quote = {
      id: quoteId,
      workspace: access.workspace,
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
    const access = await resolveWorkspace(req, searchParams.get('workspace'));
    if (!access.workspace) return NextResponse.json({ error: access.error }, { status: access.session ? 403 : 401 });
    if (access.session?.role !== 'master') return NextResponse.json({ error: 'Exclusão exige perfil master.' }, { status: 403 });
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    await deleteQuote(id, access.workspace);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
