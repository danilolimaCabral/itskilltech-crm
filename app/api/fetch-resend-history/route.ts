import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ success: false, error: 'RESEND_API_KEY não configurada na Vercel' }, { status: 400 });
  }

  try {
    // 1. Buscar os e-mails enviados do Resend via API deles
    const res = await fetch('https://api.resend.com/emails', {
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ success: false, error: 'Erro na API do Resend: ' + errText }, { status: 500 });
    }

    const data = await res.json();
    const sentEmails = data.data || []; // Lista de e-mails enviados

    // 2. Buscar todos os leads
    const { rows: leads } = await sql`SELECT * FROM leads;`;
    
    let updatedLeadsCount = 0;
    let addedEventsCount = 0;

    for (const email of sentEmails) {
      const toEmail = email.to?.[0]?.toLowerCase();
      if (!toEmail) continue;

      // Encontrar o lead correspondente ao e-mail
      const lead = leads.find(l => l.email?.toLowerCase() === toEmail);
      if (!lead) continue;

      let notes = lead.notes || '';
      const timelineMatch = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      let timeline: any[] = [];

      if (timelineMatch) {
        try {
          timeline = JSON.parse(timelineMatch[1]);
        } catch {
          timeline = [];
        }
      }

      if (!Array.isArray(timeline)) timeline = [];

      // Verificar se este e-mail já existe na timeline
      const emailDate = new Date(email.created_at).getTime();
      const exists = timeline.some(ev => ev.type === 'email' && Math.abs(new Date(ev.date || ev.ts).getTime() - emailDate) < 10000);

      if (!exists) {
        timeline.push({
          type: 'email',
          label: `📧 E-mail enviado: "${email.subject || 'Apresentação'}"`,
          date: email.created_at,
          ts: emailDate
        });
        addedEventsCount++;

        // Ordenar timeline por data
        timeline.sort((a, b) => (a.ts || new Date(a.date || a.ts).getTime()) - (b.ts || new Date(b.date || b.ts).getTime()));

        const cleanNotes = notes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
        const updatedNotes = `${cleanNotes}\n\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`.trim();

        await sql`
          UPDATE leads
          SET notes = ${updatedNotes}, updated_at = ${new Date().toISOString()}
          WHERE id = ${lead.id}
        `;
        updatedLeadsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronização com o Resend concluída com sucesso!',
      emails_fetched: sentEmails.length,
      repaired_leads: updatedLeadsCount,
      added_events: addedEventsCount
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
