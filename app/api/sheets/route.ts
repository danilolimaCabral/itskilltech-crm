import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, getLeads, upsertLead } from '@/lib/db';
export const dynamic = 'force-dynamic';

// ID da planilha do Google Sheets (público via CSV export)
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1iKPPIP3q6lgh4CQuHBH0frIMLOnd3MpAKXsjvwU9EuY';

// Abas disponíveis com seus GIDs
const SHEET_TABS = [
  { name: '2026',       gid: '0' },
  { name: 'SMB',        gid: '1897665938' },
  { name: 'Novos 2026', gid: '1346962403' },
];

// Mapear status da planilha para status do CRM
function mapStatus(s: string): string {
  const lower = (s || '').toLowerCase();
  if (lower.includes('perdido'))    return 'perdido';
  if (lower.includes('fechado'))    return 'fechamento';
  if (lower.includes('apresenta'))  return 'apresentacao';
  if (lower.includes('qualifica'))  return 'qualificacao';
  if (lower.includes('email') || lower.includes('e-mail')) return 'email_aberto';
  return 'prospeccao';
}

// Buscar CSV de uma aba da planilha
async function fetchSheetCSV(gid: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Erro ao buscar aba gid=${gid}: ${res.status}`);
  return res.text();
}

// Parsear CSV simples
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    // Parsear campos com vírgulas dentro de aspas
    const fields: string[] = [];
    let inQuote = false;
    let cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (fields[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

// Converter linha da planilha em lead do CRM
function rowToLead(row: Record<string, string>, workspace: string, tabName: string) {
  const empresa = (row['Empresa'] || row['empresa'] || '').trim();
  if (!empresa) return null;

  const nome = (row['Nome Contato'] || row['Nome'] || row['nome'] || '').trim();
  const cargo = (row['Cargo'] || row['cargo'] || '').trim();
  const telefone = (row['Telefone'] || row['telefone'] || row['Tel. Empresa'] || '').trim();
  const email = (row['E-mail'] || row['Email'] || row['email'] || '').trim();
  const statusPlanilha = (row['Status'] || row['status'] || '').trim();
  const nivelDecisao = (row['Nível Decisão'] || '').trim();

  return {
    id: `sheet_${SHEET_ID}_${tabName}_${empresa}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 80),
    workspace,
    name: nome || empresa,
    company: empresa,
    role: cargo,
    email: email || `contato@${empresa.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`,
    phone: telefone,
    whatsapp: telefone,
    linkedin: '',
    source: `Planilha getLOG - ${tabName}`,
    notes: nivelDecisao ? `Nível de Decisão: ${nivelDecisao}` : '',
    status: mapStatus(statusPlanilha),
    call_count: 0,
    last_contact: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

// ── GET: importar ou sincronizar leads da planilha ────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace') || 'getLOG';
  const action = searchParams.get('action') || 'import';
  const tab = searchParams.get('tab') || 'all';

  await initDatabase();

  if (action === 'export') {
    // Exportar leads do CRM como CSV
    const leads = await getLeads(workspace);
    const headers = ['Empresa', 'Nome Contato', 'Cargo', 'Telefone', 'E-mail', 'Status', 'Fonte'];
    const rows = leads.map(l => [
      l.company || l.name,
      l.name,
      l.role || '',
      l.phone || l.whatsapp || '',
      l.email || '',
      l.status || '',
      l.source || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads_${workspace}_${Date.now()}.csv"`,
      },
    });
  }

  // Importar / sincronizar
  const tabsToProcess = tab === 'all' ? SHEET_TABS : SHEET_TABS.filter(t => t.name === tab);
  const results: { tab: string; imported: number; skipped: number; errors: string[] }[] = [];
  const existingLeads = await getLeads(workspace);
  const existingEmails = new Set(existingLeads.map(l => l.email?.toLowerCase()).filter(Boolean));
  const existingCompanies = new Set(existingLeads.map(l => l.company?.toLowerCase()).filter(Boolean));

  for (const sheetTab of tabsToProcess) {
    const tabResult = { tab: sheetTab.name, imported: 0, skipped: 0, errors: [] as string[] };
    try {
      const csv = await fetchSheetCSV(sheetTab.gid);
      const rows = parseCSV(csv);
      for (const row of rows) {
        const lead = rowToLead(row, workspace, sheetTab.name);
        if (!lead) { tabResult.skipped++; continue; }

        // Verificar duplicata por e-mail ou empresa
        const emailLower = lead.email?.toLowerCase();
        const companyLower = lead.company?.toLowerCase();
        const isDuplicate =
          (emailLower && !emailLower.startsWith('contato@') && existingEmails.has(emailLower)) ||
          (companyLower && existingCompanies.has(companyLower));

        if (isDuplicate && action !== 'sync') {
          tabResult.skipped++;
          continue;
        }

        try {
          await upsertLead(lead);
          tabResult.imported++;
          if (emailLower) existingEmails.add(emailLower);
          if (companyLower) existingCompanies.add(companyLower);
        } catch (e) {
          tabResult.errors.push(`${lead.company}: ${e}`);
        }
      }
    } catch (e) {
      tabResult.errors.push(`Erro ao buscar aba ${sheetTab.name}: ${e}`);
    }
    results.push(tabResult);
  }

  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

  return NextResponse.json({
    ok: true,
    action,
    workspace,
    totalImported,
    totalSkipped,
    results,
    message: `✅ ${totalImported} leads importados, ${totalSkipped} ignorados (duplicatas)`,
  });
}

// ── POST: importar leads de um CSV enviado pelo usuário ───────────────────────
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace') || 'getLOG';

  await initDatabase();

  let body: { leads?: Record<string, string>[]; tab?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const { leads: rawLeads = [], tab = 'Manual' } = body;
  const existingLeads = await getLeads(workspace);
  const existingCompanies = new Set(existingLeads.map(l => l.company?.toLowerCase()).filter(Boolean));

  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rawLeads) {
    const lead = rowToLead(row, workspace, tab);
    if (!lead) { skipped++; continue; }
    if (existingCompanies.has(lead.company?.toLowerCase())) { skipped++; continue; }
    try {
      await upsertLead(lead);
      imported++;
      existingCompanies.add(lead.company?.toLowerCase());
    } catch (e) {
      errors.push(`${lead.company}: ${e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    errors,
    message: `✅ ${imported} leads importados, ${skipped} ignorados`,
  });
}
