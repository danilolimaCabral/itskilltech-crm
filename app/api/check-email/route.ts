import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const targetEmail = 'sac2@tegape.com.br';

    // 1. Buscar se existe algum lead com esse e-mail
    const { rows: leads } = await sql`
      SELECT id, name, company, email, notes, updated_at 
      FROM leads 
      WHERE email = ${targetEmail} OR notes LIKE ${'%' + targetEmail + '%'}
    `;

    // 2. Buscar se existe algum registro de e-mail enviado na tabela de e-mails enviados
    // Vamos verificar se existe uma tabela sent_emails ou similar no db.ts.
    // Para garantir, vamos fazer uma busca ampla nas tabelas ou listar as tabelas se necessário.
    // Mas podemos verificar a timeline de todos os leads do workspace lottus para ver se há algum evento de e-mail enviado para sac2@tegape.com.br
    const { rows: allLeads } = await sql`
      SELECT id, name, company, email, notes 
      FROM leads 
      WHERE workspace = 'lottus'
    `;

    const foundInTimeline: any[] = [];
    for (const lead of allLeads) {
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
        // Se o evento for de e-mail e contiver o e-mail alvo ou se o lead for o alvo
        if (ev.type === 'email' && (lead.email === targetEmail || JSON.stringify(ev).includes(targetEmail))) {
          foundInTimeline.push({
            leadId: lead.id,
            leadName: lead.name,
            leadCompany: lead.company,
            leadEmail: lead.email,
            event: ev,
            dateStr: ev.ts ? new Date(ev.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'no-ts'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      targetEmail,
      leadsDirectMatch: leads.map(l => ({
        id: l.id,
        name: l.name,
        company: l.company,
        email: l.email,
        updated_at: l.updated_at ? new Date(l.updated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null
      })),
      foundInTimeline
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
