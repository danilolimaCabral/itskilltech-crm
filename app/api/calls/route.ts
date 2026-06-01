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

    // Atualizar status e contagem do lead
    if (lead) {
      const newStatus = RESULT_TO_STATUS[result] || lead.status;
      const updatedLead = {
        ...lead,
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
