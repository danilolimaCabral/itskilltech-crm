import { NextResponse } from 'next/server';
import { getLeads, upsertLead, deleteLead, hasDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/leads?workspace=lottus
export async function GET(req: Request) {
  if (!hasDatabase) return NextResponse.json({ hasDatabase: false, leads: [] });
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get('workspace') || 'lottus';
    const leads = await getLeads(workspace);
    return NextResponse.json({ hasDatabase: true, leads });
  } catch (e: any) {
    return NextResponse.json({ hasDatabase: true, leads: [], error: e.message }, { status: 500 });
  }
}

// POST /api/leads  (cria ou atualiza)
export async function POST(req: Request) {
  if (!hasDatabase) return NextResponse.json({ hasDatabase: false, ok: false });
  try {
    const lead = await req.json();
    await upsertLead(lead);
    return NextResponse.json({ hasDatabase: true, ok: true, lead });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/leads?id=xxx
export async function DELETE(req: Request) {
  if (!hasDatabase) return NextResponse.json({ hasDatabase: false, ok: false });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) await deleteLead(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
