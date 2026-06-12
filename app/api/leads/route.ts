import { NextResponse } from 'next/server';
import { getLeads, upsertLead, deleteLead, hasDatabase } from '@/lib/db';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// GET /api/leads?workspace=lottus
export async function GET(req: Request) {
  if (!hasDatabase) return NextResponse.json({ hasDatabase: false, leads: [] });
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get('workspace') || 'lottus';
    const leads = await getLeads(workspace);
    return NextResponse.json({ hasDatabase: true, leads });
  } catch (e: any) {
    return NextResponse.json({ hasDatabase: true, leads: [], error: e.message }, { status: 500 });
  }
}

// POST /api/leads  (cria ou atualiza com proteção de timeline)
export async function POST(req: Request) {
  if (!hasDatabase) return NextResponse.json({ hasDatabase: false, ok: false });
  try {
    const lead = await req.json();
    
    if (!lead.id) {
      return NextResponse.json({ ok: false, error: 'ID do lead é obrigatório' }, { status: 400 });
    }

    // ─── PROTEÇÃO E MESCLAGEM INTELIGENTE DE TIMELINE ───
    // Buscar o lead existente no banco de dados para garantir que não vamos perder histórico
    const { rows } = await sql`SELECT notes FROM leads WHERE id = ${lead.id};`;
    
    if (rows.length > 0) {
      const existingNotes = rows[0].notes || '';
      const incomingNotes = lead.notes || '';

      // Extrair timeline do banco
      const existingMatch = existingNotes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      let existingTimeline: any[] = [];
      if (existingMatch) {
        try { existingTimeline = JSON.parse(existingMatch[1]); } catch { existingTimeline = []; }
      }

      // Extrair timeline enviada no payload
      const incomingMatch = incomingNotes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      let incomingTimeline: any[] = [];
      if (incomingMatch) {
        try { incomingTimeline = JSON.parse(incomingMatch[1]); } catch { incomingTimeline = []; }
      }

      // Se ambas as timelines têm conteúdo, vamos mesclá-las de forma inteligente
      if (existingTimeline.length > 0 || incomingTimeline.length > 0) {
        // Criar um mapa usando o timestamp como chave para evitar eventos duplicados
        const mergedMap = new Map<string, any>();

        // Inserir primeiro a timeline do banco (garante que o que está no banco é preservado)
        for (const ev of existingTimeline) {
          if (!ev.ts) continue;
          // Usar chave composta por ts e tipo para ser ultra preciso
          const key = `${ev.ts}_${ev.type || ''}`;
          mergedMap.set(key, ev);
        }

        // Inserir/Sobrescrever com os novos eventos da timeline recebida
        for (const ev of incomingTimeline) {
          if (!ev.ts) continue;
          const key = `${ev.ts}_${ev.type || ''}`;
          // Se já existir, podemos atualizar os campos, mas mantemos o evento
          mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...ev });
        }

        // Converter de volta para array e ordenar de forma decrescente (mais recentes primeiro)
        const mergedTimeline = Array.from(mergedMap.values())
          .sort((a, b) => (b.ts || 0) - (a.ts || 0));

        // Limpar as tags [TIMELINE] das notas enviadas e do banco para manter apenas o texto puro das anotações
        const cleanIncomingNotes = incomingNotes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
        const cleanExistingNotes = existingNotes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();

        // Mesclar as anotações textuais se forem diferentes (sem duplicar texto idêntico)
        let finalNotesText = cleanIncomingNotes;
        if (cleanExistingNotes && cleanExistingNotes !== cleanIncomingNotes) {
          // Se as novas notas não contêm as antigas, podemos anexar ou manter a mais completa.
          // Como padrão, vamos manter as novas notas, mas se as novas notas estiverem vazias e as antigas tiverem conteúdo, preservamos as antigas.
          if (!cleanIncomingNotes && cleanExistingNotes) {
            finalNotesText = cleanExistingNotes;
          } else if (cleanIncomingNotes && !cleanIncomingNotes.includes(cleanExistingNotes)) {
            // Se as novas notas não contêm as antigas, vamos concatenar de forma elegante
            finalNotesText = `${cleanIncomingNotes}\n\n[Histórico Anterior]\n${cleanExistingNotes}`;
          }
        }

        // Montar a nota final com a timeline mesclada e protegida
        lead.notes = `${finalNotesText}\n\n[TIMELINE]${JSON.stringify(mergedTimeline)}[/TIMELINE]`.trim();
      }
    }

    await upsertLead(lead);
    return NextResponse.json({ hasDatabase: true, ok: true, lead });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/leads?id=xxx
export async function DELETE(req: Request) {
  if (!hasDatabase) return NextResponse.json({ hasDatabase: false, ok: false });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) await deleteLead(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
