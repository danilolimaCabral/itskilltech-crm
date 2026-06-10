import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { hasDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace') || 'lottus';
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  if (!hasDatabase) {
    return NextResponse.json({ days: [], totals: { whatsapp: 0, email: 0, call: 0, total: 0 } });
  }

  try {
    // Buscar todos os leads com timeline no workspace
    const { rows: leads } = await sql`
      SELECT id, name, company, status, notes, updated_at
      FROM leads
      WHERE workspace = ${workspace}
      AND notes LIKE '%[TIMELINE]%'
      ORDER BY updated_at DESC;
    `;

    // Processar timeline de cada lead
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    // Mapa: data -> { whatsapp, email, call, total, leads: [] }
    const dayMap: Record<string, { whatsapp: number; email: number; call: number; total: number; leads: any[] }> = {};

    for (const lead of leads) {
      const notes = lead.notes || '';
      const match = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      if (!match) continue;
      let timeline: any[] = [];
      try { timeline = JSON.parse(match[1]); } catch { continue; }

      for (const ev of timeline) {
        if (!ev.ts || ev.ts < cutoff) continue;
        const dateKey = new Date(ev.ts).toISOString().slice(0, 10);
        if (!dayMap[dateKey]) dayMap[dateKey] = { whatsapp: 0, email: 0, call: 0, total: 0, leads: [] };

        if (ev.type === 'whatsapp') { dayMap[dateKey].whatsapp++; dayMap[dateKey].total++; }
        else if (ev.type === 'email') { dayMap[dateKey].email++; dayMap[dateKey].total++; }
        else if (ev.type === 'call') { dayMap[dateKey].call++; dayMap[dateKey].total++; }

        // Registrar lead prospectado neste dia (sem duplicar)
        if (['whatsapp', 'email', 'call'].includes(ev.type)) {
          const alreadyIn = dayMap[dateKey].leads.find((l: any) => l.id === lead.id);
          if (!alreadyIn) {
            dayMap[dateKey].leads.push({
              id: lead.id,
              name: lead.name,
              company: lead.company,
              status: lead.status,
              type: ev.type,
              ts: ev.ts,
            });
          }
        }
      }
    }

    // Converter para array ordenado por data
    const daysArr = Object.entries(dayMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Totais gerais
    const totals = daysArr.reduce(
      (acc, d) => ({
        whatsapp: acc.whatsapp + d.whatsapp,
        email: acc.email + d.email,
        call: acc.call + d.call,
        total: acc.total + d.total,
      }),
      { whatsapp: 0, email: 0, call: 0, total: 0 }
    );

    return NextResponse.json({ days: daysArr, totals });
  } catch (e) {
    console.error('gestor-stats error:', e);
    return NextResponse.json({ days: [], totals: { whatsapp: 0, email: 0, call: 0, total: 0 } });
  }
}
