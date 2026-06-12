import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    console.log("Iniciando debug de banco de dados...");
    
    // 1. Verificar total de leads por workspace
    const { rows: leadsByWorkspace } = await sql`
      SELECT workspace, COUNT(*) as count 
      FROM leads 
      GROUP BY workspace;
    `;

    // 2. Verificar total de ligações (call_logs) por workspace
    const { rows: callsByWorkspace } = await sql`
      SELECT workspace, COUNT(*) as count 
      FROM call_logs 
      GROUP BY workspace;
    `;

    // 3. Buscar os 30 últimos logs de ligações cadastrados de qualquer workspace
    const { rows: lastCalls } = await sql`
      SELECT id, lead_id, workspace, result, notes, created_at 
      FROM call_logs 
      ORDER BY created_at DESC 
      LIMIT 30;
    `;

    // 4. Buscar leads que foram atualizados recentemente e que tenham [TIMELINE]
    const { rows: recentLeadsWithTimeline } = await sql`
      SELECT id, name, workspace, status, updated_at, notes
      FROM leads
      WHERE notes LIKE '%[TIMELINE]%'
      ORDER BY updated_at DESC
      LIMIT 30;
    `;

    // 5. Contar quantos leads têm timeline em cada workspace
    const { rows: timelineCount } = await sql`
      SELECT workspace, COUNT(*) as count
      FROM leads
      WHERE notes LIKE '%[TIMELINE]%'
      GROUP BY workspace;
    `;

    return NextResponse.json({
      ok: true,
      summary: {
        leads_by_workspace: leadsByWorkspace,
        calls_by_workspace: callsByWorkspace,
        timeline_count_by_workspace: timelineCount,
      },
      last_calls_registered: lastCalls.map(c => ({
        ...c,
        date_formatted: new Date(Number(c.created_at)).toLocaleString('pt-BR')
      })),
      recent_leads_prospecting: recentLeadsWithTimeline.map(l => {
        const match = l.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
        return {
          id: l.id,
          name: l.name,
          workspace: l.workspace,
          status: l.status,
          updated_at_formatted: new Date(Number(l.updated_at) || Date.now()).toLocaleString('pt-BR'),
          timeline_preview: match ? match[1].slice(0, 300) : null,
          raw_notes_preview: l.notes?.slice(0, 150)
        };
      })
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
