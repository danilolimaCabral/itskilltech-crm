import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Buscar qualquer registro contendo "multigiro" em qualquer coluna
    const { rows: multigiroLeads } = await sql`
      SELECT * FROM leads 
      WHERE company ILIKE '%multigiro%' 
         OR name ILIKE '%multigiro%' 
         OR notes ILIKE '%multigiro%'
    `;

    // 2. Buscar leads deletados recentemente se houver algum log ou se eles ainda estiverem no banco com status inativo
    const { rows: allLeads } = await sql`
      SELECT id, name, company, email, phone, whatsapp, notes, workspace, status 
      FROM leads
    `;

    return NextResponse.json({
      ok: true,
      multigiro: multigiroLeads,
      total_leads_in_db: allLeads.length,
      sample: allLeads.slice(0, 5)
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
