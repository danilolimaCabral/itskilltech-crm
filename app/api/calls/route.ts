import { NextResponse } from 'next/server';
import { getCallLogs, insertCallLog, upsertLead } from '@/lib/db';
import { getLeads } from '@/lib/db';
export const dynamic = 'force-dynamic';

const uid = () => 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

// Mapeamento de resultado da ligação para próximo status do lead
const RESULT_TO_STATUS: Record<string, string> = {
  'atendeu_interesse': 'negociacao',
  'atendeu_sem_interesse': 'contatado',
  'atendeu_retornar': 'contatado',
  'nao_atendeu': 'novo',
  'caixa_postal': 'novo',
  'numero_errado': 'novo',
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('lead_id');
    if (!leadId) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 });
    const logs = await getCallLogs(leadId);
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lead_id, workspace, result, notes, duration, lead } = body;

    if (!lead_id || !workspace || !result) {
      return NextResponse.json({ error: 'lead_id, workspace e result são obrigatórios' }, { status: 400 });
    }

    // Registrar a ligação
    const log = {
      id: uid(),
      lead_id,
      workspace,
      result,
      notes: notes || '',
      duration: duration || 0,
      created_at: Date.now(),
    };
    await insertCallLog(log);

    // Atualizar status e contagem do lead e registrar na timeline
    if (lead) {
      const newStatus = RESULT_TO_STATUS[result] || lead.status;
      
      // Parsear timeline existente
      let timeline: any[] = [];
      try {
        timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
      } catch {
        timeline = [];
      }

      // Adicionar o evento de ligação
      timeline.push({
        id: 'ev_' + Math.random().toString(36).slice(2, 9),
        type: 'call',
        label: 'Ligação realizada',
        notes: notes || `Resultado: ${result === 'atendeu_interesse' ? 'Atendeu (Com Interesse)' : result === 'atendeu_sem_interesse' ? 'Atendeu (Sem Interesse)' : result === 'atendeu_retornar' ? 'Atendeu (Retornar)' : result === 'nao_atendeu' ? 'Não Atendeu' : result === 'caixa_postal' ? 'Caixa Postal' : 'Número Errado'}`,
        ts: Date.now(),
        user: 'Ricardo'
      });

      // Reconstruir notas protegendo a timeline
      const cleanNotes = (lead.notes || '').replace(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/g, '').trim();
      const newNotes = `${cleanNotes}\n\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`.trim();

      const updatedLead = {
        ...lead,
        notes: newNotes,
        status: newStatus,
        call_count: (lead.call_count || 0) + 1,
        last_contact: Date.now(),
        updated_at: Date.now(),
      };
      await upsertLead(updatedLead);
      return NextResponse.json({ ok: true, log, new_status: newStatus, lead: updatedLead });
    }

    return NextResponse.json({ ok: true, log });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
