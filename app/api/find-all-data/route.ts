import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  try {
    // Buscar todos os leads de todos os workspaces
    const { rows: leads } = await sql`
      SELECT id, name, company, notes, workspace, updated_at
      FROM leads;
    `;
    
    const eventsFound: any[] = [];
    const workspaceStats: Record<string, any> = {};

    for (const lead of leads) {
      const notes = lead.notes || '';
      const match = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      
      const ws = lead.workspace || 'lottus';
      if (!workspaceStats[ws]) {
        workspaceStats[ws] = { leads: 0, emails: 0, whatsapps: 0, calls: 0, total_events: 0 };
      }
      workspaceStats[ws].leads++;

      if (!match) continue;
      
      let timeline = [];
      try { timeline = JSON.parse(match[1]); } catch { continue; }
      
      for (const ev of timeline) {
        workspaceStats[ws].total_events++;
        if (ev.type === 'email') workspaceStats[ws].emails++;
        if (ev.type === 'whatsapp') workspaceStats[ws].whatsapps++;
        if (ev.type === 'call') workspaceStats[ws].calls++;

        const dateStr = new Date(ev.ts).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        
        eventsFound.push({
          lead: lead.name,
          company: lead.company,
          workspace: ws,
          type: ev.type,
          date: dateStr,
          label: ev.label,
          ts: ev.ts
        });
      }
    }
    
    // Ordenar todos os eventos encontrados por data decrescente (mais recentes primeiro)
    eventsFound.sort((a, b) => b.ts - a.ts);
    
    return NextResponse.json({
      success: true,
      workspace_summary: workspaceStats,
      total_events_found: eventsFound.length,
      recent_activities: eventsFound.slice(0, 100) // Mostrar as últimas 100 atividades de todos os workspaces
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
