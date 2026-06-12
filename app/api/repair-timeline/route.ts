import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(req: NextRequest) {
  try {
    // 1. Buscar todos os leads
    const { rows: leads } = await sql`SELECT * FROM leads;`;
    
    // 2. Buscar todas as ligações registradas na tabela call_logs
    const { rows: calls } = await sql`SELECT * FROM call_logs ORDER BY created_at ASC;`;

    let repairedLeadsCount = 0;
    let addedEventsCount = 0;

    for (const lead of leads) {
      let notes = lead.notes || '';
      
      // Extrair a timeline atual
      const timelineMatch = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      let timeline: any[] = [];
      let isCorrupted = false;

      // Se notes for um JSON puro (erro causado pelo track-email antigo), é uma timeline corrompida
      if (notes.trim().startsWith('[') && notes.trim().endsWith(']')) {
        try {
          timeline = JSON.parse(notes);
          isCorrupted = true;
          notes = ''; // Limpar o JSON puro para podermos reconstruir o campo notes limpo
        } catch {
          timeline = [];
        }
      } else if (timelineMatch) {
        try {
          timeline = JSON.parse(timelineMatch[1]);
        } catch {
          timeline = [];
        }
      }

      if (!Array.isArray(timeline)) timeline = [];

      // Filtrar as ligações deste lead na tabela call_logs
      const leadCalls = calls.filter(c => c.lead_id === lead.id);
      let changed = isCorrupted;

      for (const call of leadCalls) {
        // Tratar o timestamp de forma segura
        const callTime = call.created_at ? new Date(call.created_at).getTime() : Date.now();
        if (isNaN(callTime)) continue;

        // Verificar se a ligação já existe na timeline (pelo timestamp ou proximidade de 5s)
        const exists = timeline.some(ev => {
          const evTime = ev.ts || (ev.date ? new Date(ev.date).getTime() : null);
          return ev.type === 'call' && evTime && Math.abs(evTime - callTime) < 5000;
        });
        
        if (!exists) {
          timeline.push({
            type: 'call',
            label: `Ligação realizada: ${call.result === 'atendeu_interesse' ? 'Atendeu e tem Interesse' : call.result === 'atendeu_sem_interesse' ? 'Atendeu sem Interesse' : call.result === 'nao_atendeu' ? 'Não Atendeu' : call.result === 'caixa_postal' ? 'Caixa Postal' : 'Número Errado'}`,
            note: call.notes,
            date: new Date(callTime).toISOString(),
            ts: callTime
          });
          addedEventsCount++;
          changed = true;
        }
      }

      // Ordenar a timeline reconstruída por timestamp de forma segura
      timeline.sort((a, b) => {
        const tA = a.ts || (a.date ? new Date(a.date).getTime() : 0);
        const tB = b.ts || (b.date ? new Date(b.date).getTime() : 0);
        return tA - tB;
      });

      if (changed) {
        // Limpar qualquer tag timeline antiga e salvar a nova reconstruída de forma limpa
        const cleanNotes = notes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
        const updatedNotes = `${cleanNotes}\n\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`.trim();

        await sql`
          UPDATE leads
          SET notes = ${updatedNotes}, updated_at = ${new Date().toISOString()}
          WHERE id = ${lead.id}
        `;
        repairedLeadsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Reparação de timelines concluída com sucesso!',
      repaired_leads: repairedLeadsCount,
      added_events: addedEventsCount
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
