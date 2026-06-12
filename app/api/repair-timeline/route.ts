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
        // Verificar se a ligação já existe na timeline (pelo timestamp ou proximidade de 5s)
        const exists = timeline.some(ev => ev.type === 'call' && Math.abs((ev.ts || new Date(ev.date || ev.ts).getTime()) - call.created_at) < 5000);
        
        if (!exists) {
          timeline.push({
            type: 'call',
            label: `Ligação realizada: ${call.result === 'atendeu_interesse' ? 'Atendeu e tem Interesse' : call.result === 'atendeu_sem_interesse' ? 'Atendeu sem Interesse' : call.result === 'nao_atendeu' ? 'Não Atendeu' : call.result === 'caixa_postal' ? 'Caixa Postal' : 'Número Errado'}`,
            note: call.notes,
            date: new Date(call.created_at).toISOString(),
            ts: call.created_at
          });
          addedEventsCount++;
          changed = true;
        }
      }

      // Ordenar a timeline reconstruída por timestamp
      timeline.sort((a, b) => (a.ts || new Date(a.date || a.ts).getTime()) - (b.ts || new Date(b.date || b.ts).getTime()));

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
