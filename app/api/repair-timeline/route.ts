import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  try {
    // 1. Buscar todas as ligações do banco
    const { rows: calls } = await sql`
      SELECT id, lead_id, result, notes, created_at, workspace 
      FROM call_logs 
      ORDER BY created_at ASC;
    `;

    let repairedCount = 0;
    const details = [];

    // 2. Para cada ligação, verificar e reparar o lead correspondente
    for (const call of calls) {
      if (!call.lead_id) continue;

      // Buscar o lead atual
      const { rows: leads } = await sql`
        SELECT id, name, company, notes 
        FROM leads 
        WHERE id = ${call.lead_id};
      `;

      if (leads.length === 0) continue;
      const lead = leads[0];

      // Analisar a timeline atual do lead
      const notesRaw = lead.notes || '';
      const timelineMatch = notesRaw.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      let timeline = [];
      try {
        timeline = timelineMatch ? JSON.parse(timelineMatch[1]) : [];
      } catch {
        timeline = [];
      }

      // Verificar se esta ligação específica já está na timeline (pelo timestamp aproximado)
      const callTime = Number(call.created_at);
      const alreadyExists = timeline.some((ev: any) => 
        ev.type === 'call' && Math.abs(ev.ts - callTime) < 5000 // diferença de menos de 5 segundos
      );

      if (!alreadyExists) {
        // Inserir a ligação de volta na timeline
        const callResultLabel = call.result === 'atendeu_interesse' ? 'Atendeu e tem Interesse' :
                               call.result === 'atendeu_sem_interesse' ? 'Atendeu sem Interesse' :
                               call.result === 'nao_atendeu' ? 'Não Atendeu' :
                               call.result === 'caixa_postal' ? 'Caixa Postal' : 'Número Errado';

        const label = `Ligação realizada: ${callResultLabel}${call.notes ? ` (${call.notes})` : ''}`;
        
        timeline.unshift({
          type: 'call',
          label,
          ts: callTime,
          result: call.result
        });

        // Ordenar timeline por timestamp decrescente
        timeline.sort((a: any, b: any) => b.ts - a.ts);

        const notesBase = notesRaw.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
        const nextNotes = notesBase + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`;

        // Salvar lead com a timeline reparada
        await sql`
          UPDATE leads 
          SET notes = ${nextNotes}, updated_at = ${Date.now()} 
          WHERE id = ${lead.id};
        `;

        repairedCount++;
        details.push({
          lead: lead.name,
          company: lead.company,
          date: new Date(callTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          label
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reparação concluída com sucesso! ${repairedCount} ligações foram reinseridas nas timelines dos leads.`,
      repairedCount,
      details
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
