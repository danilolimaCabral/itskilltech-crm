import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  try {
    const { rows: leads } = await sql`
      SELECT id, name, company, notes 
      FROM leads 
      WHERE workspace = 'lottus';
    `;
    
    let totalEmails = 0;
    let totalWhats = 0;
    let totalCalls = 0;
    
    const targetDays = ['10/06', '11/06', '12/06'];
    const eventsFound: any[] = [];

    for (const lead of leads) {
      const notes = lead.notes || '';
      const match = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      if (!match) continue;
      
      let timeline = [];
      try { timeline = JSON.parse(match[1]); } catch { continue; }
      
      for (const ev of timeline) {
        const dateStr = new Date(ev.ts).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).substring(0, 5);
        if (targetDays.includes(dateStr)) {
          if (ev.type === 'email') totalEmails++;
          if (ev.type === 'whatsapp') totalWhats++;
          if (ev.type === 'call') totalCalls++;
          
          eventsFound.push({
            lead: lead.name,
            company: lead.company,
            type: ev.type,
            date: dateStr,
            label: ev.label,
            ts: ev.ts
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      totals: {
        emails: totalEmails,
        whatsapps: totalWhats,
        calls: totalCalls,
        total_activities: totalEmails + totalWhats + totalCalls
      },
      events: eventsFound.slice(-50) // retornar os últimos 50 eventos
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
