import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { hasDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace') || 'lottus';

  if (!hasDatabase) {
    return NextResponse.json({ error: 'no-database' }, { status: 400 });
  }

  try {
    // Totais de leads por status
    const { rows: leadStats } = await sql`
      SELECT status, COUNT(*) as count
      FROM leads WHERE workspace = ${workspace}
      GROUP BY status;
    `;

    // Total de ligações e resultados
    const { rows: callStats } = await sql`
      SELECT result, COUNT(*) as count
      FROM call_logs WHERE workspace = ${workspace}
      GROUP BY result;
    `;

    // Ligações por dia (últimos 30 dias)
    const { rows: callsByDay } = await sql`
      SELECT
        TO_CHAR(TO_TIMESTAMP(created_at / 1000), 'DD/MM') as day,
        COUNT(*) as count
      FROM call_logs
      WHERE workspace = ${workspace}
        AND created_at > ${Date.now() - 30 * 24 * 60 * 60 * 1000}
      GROUP BY day
      ORDER BY MIN(created_at) ASC;
    `;

    // Leads criados por dia (últimos 30 dias)
    const { rows: leadsByDay } = await sql`
      SELECT
        TO_CHAR(TO_TIMESTAMP(created_at / 1000), 'DD/MM') as day,
        COUNT(*) as count
      FROM leads
      WHERE workspace = ${workspace}
        AND created_at > ${Date.now() - 30 * 24 * 60 * 60 * 1000}
      GROUP BY day
      ORDER BY MIN(created_at) ASC;
    `;

    // Total geral de ligações
    const { rows: totalCalls } = await sql`
      SELECT COUNT(*) as total FROM call_logs WHERE workspace = ${workspace};
    `;

    // Leads contatados (tiveram pelo menos 1 ligação)
    const { rows: contactedLeads } = await sql`
      SELECT COUNT(DISTINCT lead_id) as count FROM call_logs WHERE workspace = ${workspace};
    `;

    // Matches = leads que foram para negociação ou fechado
    const { rows: matches } = await sql`
      SELECT COUNT(*) as count FROM leads
      WHERE workspace = ${workspace} AND status IN ('negociacao', 'fechado');
    `;

    // Fechados
    const { rows: closed } = await sql`
      SELECT COUNT(*) as count FROM leads
      WHERE workspace = ${workspace} AND status = 'fechado';
    `;

    // Montar resposta
    const statusMap: Record<string, number> = {};
    leadStats.forEach((r: any) => { statusMap[r.status] = parseInt(r.count); });

    const callMap: Record<string, number> = {};
    callStats.forEach((r: any) => { callMap[r.result] = parseInt(r.count); });

    const totalLeads = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const totalCallsN = parseInt(totalCalls[0]?.total || '0');
    const contactedN = parseInt(contactedLeads[0]?.count || '0');
    const matchesN = parseInt(matches[0]?.count || '0');
    const closedN = parseInt(closed[0]?.count || '0');

    const atendidas = (callMap['atendeu_interesse'] || 0) + (callMap['atendeu_sem_interesse'] || 0);
    const taxaAtendimento = totalCallsN > 0 ? Math.round((atendidas / totalCallsN) * 100) : 0;
    const taxaMatch = contactedN > 0 ? Math.round((matchesN / contactedN) * 100) : 0;
    const taxaFechamento = matchesN > 0 ? Math.round((closedN / matchesN) * 100) : 0;

    return NextResponse.json({
      workspace,
      leads: {
        total: totalLeads,
        novo: statusMap['novo'] || 0,
        contatado: statusMap['contatado'] || 0,
        negociacao: statusMap['negociacao'] || 0,
        fechado: statusMap['fechado'] || 0,
      },
      calls: {
        total: totalCallsN,
        atendeu_interesse: callMap['atendeu_interesse'] || 0,
        atendeu_sem_interesse: callMap['atendeu_sem_interesse'] || 0,
        nao_atendeu: callMap['nao_atendeu'] || 0,
        caixa_postal: callMap['caixa_postal'] || 0,
        numero_errado: callMap['numero_errado'] || 0,
        taxa_atendimento: taxaAtendimento,
      },
      conversion: {
        contacted: contactedN,
        matches: matchesN,
        closed: closedN,
        taxa_match: taxaMatch,
        taxa_fechamento: taxaFechamento,
      },
      charts: {
        calls_by_day: callsByDay,
        leads_by_day: leadsByDay,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
