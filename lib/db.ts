import { sql } from '@vercel/postgres';

export const hasDatabase = !!(
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL
);

export async function initDatabase() {
  if (!hasDatabase) return { ok: false, reason: 'no-database' };

  // Tabela de workspaces dinâmicos
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#0066ff',
      description TEXT,
      company_name TEXT,
      company_cnpj TEXT,
      company_address TEXT,
      company_phone TEXT,
      company_email TEXT,
      quote_intro TEXT,
      quote_footer TEXT,
      created_at BIGINT
    );
  `;

  // Inserir workspaces padrão se não existirem
  await sql`
    INSERT INTO workspaces (id, name, color, created_at)
    VALUES
      ('lottus', 'Lottus Tech', '#0066ff', ${Date.now()}),
      ('iota', 'IOTA', '#6938ef', ${Date.now()}),
      ('splice', 'Splice', '#079455', ${Date.now()})
    ON CONFLICT (id) DO NOTHING;
  `;

  // Tabela de leads
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      workspace TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT,
      role TEXT,
      email TEXT,
      whatsapp TEXT,
      linkedin TEXT,
      phone TEXT,
      source TEXT,
      notes TEXT,
      status TEXT DEFAULT 'novo',
      call_count INTEGER DEFAULT 0,
      last_contact BIGINT,
      created_at BIGINT,
      updated_at BIGINT
    );
  `;

  // Adicionar colunas novas se não existirem (migration segura)
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;`; } catch {}
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact BIGINT;`; } catch {}

  // Tabela de histórico de ligações
  await sql`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      workspace TEXT NOT NULL,
      result TEXT NOT NULL,
      notes TEXT,
      duration INTEGER,
      created_at BIGINT
    );
  `;

  // Tabela de cotações
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      workspace TEXT NOT NULL,
      lead_id TEXT,
      lead_name TEXT,
      lead_company TEXT,
      lead_email TEXT,
      lead_phone TEXT,
      items JSONB,
      subtotal NUMERIC,
      discount NUMERIC DEFAULT 0,
      total NUMERIC,
      notes TEXT,
      status TEXT DEFAULT 'rascunho',
      sent_at BIGINT,
      created_at BIGINT,
      updated_at BIGINT
    );
  `;

  // Tabela de templates de mensagem
  await sql`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      workspace TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      tags TEXT,
      created_at BIGINT,
      updated_at BIGINT
    );
  `;

  return { ok: true };
}

// ---- Workspaces ----
export async function getWorkspaces() {
  if (!hasDatabase) return [];
  const { rows } = await sql`SELECT * FROM workspaces ORDER BY created_at ASC;`;
  return rows;
}

export async function upsertWorkspace(ws: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO workspaces (id, name, color, description, company_name, company_cnpj, company_address, company_phone, company_email, quote_intro, quote_footer, created_at)
    VALUES (${ws.id}, ${ws.name}, ${ws.color || '#0066ff'}, ${ws.description || ''}, ${ws.company_name || ''}, ${ws.company_cnpj || ''}, ${ws.company_address || ''}, ${ws.company_phone || ''}, ${ws.company_email || ''}, ${ws.quote_intro || ''}, ${ws.quote_footer || ''}, ${ws.created_at || Date.now()})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, color = EXCLUDED.color, description = EXCLUDED.description,
      company_name = EXCLUDED.company_name, company_cnpj = EXCLUDED.company_cnpj,
      company_address = EXCLUDED.company_address, company_phone = EXCLUDED.company_phone,
      company_email = EXCLUDED.company_email, quote_intro = EXCLUDED.quote_intro,
      quote_footer = EXCLUDED.quote_footer;
  `;
  return ws;
}

export async function deleteWorkspace(id: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM workspaces WHERE id = ${id};`;
  return { id };
}

// ---- Leads ----
export async function getLeads(workspace: string) {
  if (!hasDatabase) return [];
  const { rows } = await sql`
    SELECT * FROM leads WHERE workspace = ${workspace} ORDER BY updated_at DESC;
  `;
  return rows;
}

export async function upsertLead(lead: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO leads (id, workspace, name, company, role, email, whatsapp, linkedin, phone, source, notes, status, call_count, last_contact, created_at, updated_at)
    VALUES (${lead.id}, ${lead.workspace}, ${lead.name}, ${lead.company || ''}, ${lead.role || ''}, ${lead.email || ''}, ${lead.whatsapp || ''}, ${lead.linkedin || ''}, ${lead.phone || ''}, ${lead.source || ''}, ${lead.notes || ''}, ${lead.status || 'novo'}, ${lead.call_count || 0}, ${lead.last_contact || null}, ${lead.created_at}, ${lead.updated_at})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, company = EXCLUDED.company, role = EXCLUDED.role,
      email = EXCLUDED.email, whatsapp = EXCLUDED.whatsapp, linkedin = EXCLUDED.linkedin,
      phone = EXCLUDED.phone, source = EXCLUDED.source, notes = EXCLUDED.notes,
      status = EXCLUDED.status, call_count = EXCLUDED.call_count,
      last_contact = EXCLUDED.last_contact, updated_at = EXCLUDED.updated_at;
  `;
  return lead;
}

export async function deleteLead(id: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM leads WHERE id = ${id};`;
  return { id };
}

// ---- Ligações ----
export async function getCallLogs(leadId: string) {
  if (!hasDatabase) return [];
  const { rows } = await sql`
    SELECT * FROM call_logs WHERE lead_id = ${leadId} ORDER BY created_at DESC;
  `;
  return rows;
}

export async function insertCallLog(log: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO call_logs (id, lead_id, workspace, result, notes, duration, created_at)
    VALUES (${log.id}, ${log.lead_id}, ${log.workspace}, ${log.result}, ${log.notes || ''}, ${log.duration || 0}, ${log.created_at});
  `;
  return log;
}

// ---- Cotações ----
export async function getQuotes(workspace: string) {
  if (!hasDatabase) return [];
  const { rows } = await sql`
    SELECT * FROM quotes WHERE workspace = ${workspace} ORDER BY created_at DESC;
  `;
  return rows;
}

export async function upsertQuote(quote: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO quotes (id, workspace, lead_id, lead_name, lead_company, lead_email, lead_phone, items, subtotal, discount, total, notes, status, sent_at, created_at, updated_at)
    VALUES (${quote.id}, ${quote.workspace}, ${quote.lead_id || null}, ${quote.lead_name || ''}, ${quote.lead_company || ''}, ${quote.lead_email || ''}, ${quote.lead_phone || ''}, ${JSON.stringify(quote.items || [])}, ${quote.subtotal || 0}, ${quote.discount || 0}, ${quote.total || 0}, ${quote.notes || ''}, ${quote.status || 'rascunho'}, ${quote.sent_at || null}, ${quote.created_at}, ${quote.updated_at})
    ON CONFLICT (id) DO UPDATE SET
      lead_name = EXCLUDED.lead_name, lead_company = EXCLUDED.lead_company,
      lead_email = EXCLUDED.lead_email, lead_phone = EXCLUDED.lead_phone,
      items = EXCLUDED.items, subtotal = EXCLUDED.subtotal, discount = EXCLUDED.discount,
      total = EXCLUDED.total, notes = EXCLUDED.notes, status = EXCLUDED.status,
      sent_at = EXCLUDED.sent_at, updated_at = EXCLUDED.updated_at;
  `;
  return quote;
}

export async function deleteQuote(id: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM quotes WHERE id = ${id};`;
  return { id };
}

// ---- Templates ----
export async function getTemplates(workspace: string) {
  if (!hasDatabase) return [];
  const { rows } = await sql`
    SELECT * FROM templates WHERE workspace = ${workspace} ORDER BY created_at DESC;
  `;
  return rows;
}

export async function upsertTemplate(t: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO templates (id, workspace, name, type, subject, body, tags, created_at, updated_at)
    VALUES (${t.id}, ${t.workspace}, ${t.name}, ${t.type}, ${t.subject || ''}, ${t.body}, ${t.tags || ''}, ${t.created_at || Date.now()}, ${t.updated_at || Date.now()})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, type = EXCLUDED.type, subject = EXCLUDED.subject,
      body = EXCLUDED.body, tags = EXCLUDED.tags, updated_at = EXCLUDED.updated_at;
  `;
  return t;
}

export async function deleteTemplate(id: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM templates WHERE id = ${id};`;
  return { id };
}
