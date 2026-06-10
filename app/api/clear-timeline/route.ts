import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// POST /api/clear-timeline
// Body: { workspace: 'lottus', secret: 'danilo2024' }
// Remove o bloco [TIMELINE]...[/TIMELINE] de todos os leads do workspace
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspace = body.workspace || 'lottus';
    const secret = body.secret || '';

    // Proteção básica
    if (secret !== 'danilo2024') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todos os leads com timeline
    const { rows } = await sql`
      SELECT id, notes FROM leads
      WHERE workspace = ${workspace}
        AND notes LIKE '%[TIMELINE]%'
    `;

    let cleaned = 0;
    for (const lead of rows) {
      const notes = lead.notes || '';
      // Remove o bloco [TIMELINE]...[/TIMELINE]
      const newNotes = notes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
      await sql`
        UPDATE leads SET notes = ${newNotes}, updated_at = ${Date.now()}
        WHERE id = ${lead.id}
      `;
      cleaned++;
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      cleaned,
      message: `${cleaned} leads tiveram o histórico artificial removido. O CRM agora registrará apenas atividades reais.`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
