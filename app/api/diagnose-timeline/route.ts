import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { rows: leads } = await sql`
      SELECT id, name, company, notes, updated_at 
      FROM leads 
      WHERE workspace = 'lottus'
    `;

    const allEvents: any[] = [];
    const leadsWithEvents: any[] = [];

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

      const leadEvents = timeline.map(ev => ({
        ...ev,
        leadId: lead.id,
        leadName: lead.name,
        leadCompany: lead.company,
        dateStr: ev.ts ? new Date(ev.ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) : 'no-ts'
      }));

      allEvents.push(...leadEvents);
      
      const targetEvents = leadEvents.filter(ev => 
        ev.dateStr === '2026-06-10' || ev.dateStr === '2026-06-11'
      );

      if (targetEvents.length > 0) {
        leadsWithEvents.push({
          id: lead.id,
          name: lead.name,
          company: lead.company,
          events: targetEvents
        });
      }
    }

    // Agrupar por data e tipo
    const summary: Record<string, Record<string, number>> = {};
    for (const ev of allEvents) {
      if (!ev.dateStr) continue;
      if (!summary[ev.dateStr]) {
        summary[ev.dateStr] = { email: 0, call: 0, whatsapp: 0, total: 0 };
      }
      if (['email', 'call', 'whatsapp'].includes(ev.type)) {
        summary[ev.dateStr][ev.type] = (summary[ev.dateStr][ev.type] || 0) + 1;
        summary[ev.dateStr].total = (summary[ev.dateStr].total || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      leadsWithEventsCount: leadsWithEvents.length,
      leadsWithEvents: leadsWithEvents.slice(0, 30) // Mostrar amostra para não estourar o JSON
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
