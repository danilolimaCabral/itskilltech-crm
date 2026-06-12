import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { rows: leads } = await sql`
      SELECT id, name, company, email, notes, updated_at 
      FROM leads 
      WHERE workspace = 'lottus'
    `;

    const allEvents: any[] = [];

    for (const lead of leads) {
      const notes = lead.notes || '';
      const match = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      if (!match) continue;
      
      let timeline: any[] = [];
      try {
        timeline = JSON.parse(match[1]);
      } catch {
        continue;
      }

      for (const ev of timeline) {
        if (!ev.ts) continue;
        const dateObj = new Date(ev.ts);
        const dateStr = dateObj.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
        
        if (['email', 'call', 'whatsapp', 'linkedin'].includes(ev.type)) {
          allEvents.push({
            leadId: lead.id,
            leadName: lead.name,
            leadCompany: lead.company,
            leadEmail: lead.email,
            type: ev.type,
            label: ev.label || ev.note || '',
            ts: ev.ts,
            dateStr,
            timeStr: dateObj.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            user: ev.user || 'Danilo'
          });
        }
      }
    }

    // Ordenar eventos por timestamp decrescente
    allEvents.sort((a, b) => b.ts - a.ts);

    // Agrupar por data para o resumo
    const summary: Record<string, any> = {};
    for (const ev of allEvents) {
      if (!summary[ev.dateStr]) {
        summary[ev.dateStr] = { email: 0, call: 0, whatsapp: 0, linkedin: 0, total: 0, activities: [] };
      }
      summary[ev.dateStr][ev.type] = (summary[ev.dateStr][ev.type] || 0) + 1;
      summary[ev.dateStr].total++;
      
      // Adicionar apenas uma amostra detalhada por dia para não estourar o JSON
      if (summary[ev.dateStr].activities.length < 100) {
        summary[ev.dateStr].activities.push({
          leadName: ev.leadName,
          leadCompany: ev.leadCompany,
          type: ev.type,
          label: ev.label,
          time: ev.timeStr,
          user: ev.user
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalActivities: allEvents.length,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
