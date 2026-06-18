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
      next_call_at BIGINT,
      gestor_note TEXT,
      created_at BIGINT,
      updated_at BIGINT
    );
  `;

  // Adicionar colunas novas se não existirem (migration segura)
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;`; } catch {}
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact BIGINT;`; } catch {}
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_at BIGINT;`; } catch {}
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS gestor_note TEXT;`; } catch {}

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
      attachment_url TEXT DEFAULT '',
      created_at BIGINT,
      updated_at BIGINT
    );
  `;
  try { await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT '';`; } catch {}

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
      attachment_url TEXT DEFAULT '',
      created_at BIGINT,
      updated_at BIGINT
    );
  `;
  // Migração segura: adicionar attachment_url se não existir
  try { await sql`ALTER TABLE templates ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT '';`; } catch {}

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
    INSERT INTO leads (id, workspace, name, company, role, email, whatsapp, linkedin, phone, source, notes, status, call_count, last_contact, next_call_at, gestor_note, created_at, updated_at)
    VALUES (${lead.id}, ${lead.workspace}, ${lead.name}, ${lead.company || ''}, ${lead.role || ''}, ${lead.email || ''}, ${lead.whatsapp || ''}, ${lead.linkedin || ''}, ${lead.phone || ''}, ${lead.source || ''}, ${lead.notes || ''}, ${lead.status || 'novo'}, ${lead.call_count || 0}, ${lead.last_contact || null}, ${lead.next_call_at || null}, ${lead.gestor_note || ''}, ${lead.created_at}, ${lead.updated_at})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, company = EXCLUDED.company, role = EXCLUDED.role,
      email = EXCLUDED.email, whatsapp = EXCLUDED.whatsapp, linkedin = EXCLUDED.linkedin,
      phone = EXCLUDED.phone, source = EXCLUDED.source, notes = EXCLUDED.notes,
      status = EXCLUDED.status, call_count = EXCLUDED.call_count,
      last_contact = EXCLUDED.last_contact, next_call_at = EXCLUDED.next_call_at, gestor_note = EXCLUDED.gestor_note, updated_at = EXCLUDED.updated_at;
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
    INSERT INTO quotes (id, workspace, lead_id, lead_name, lead_company, lead_email, lead_phone, items, subtotal, discount, total, notes, status, sent_at, attachment_url, created_at, updated_at)
    VALUES (${quote.id}, ${quote.workspace}, ${quote.lead_id || null}, ${quote.lead_name || ''}, ${quote.lead_company || ''}, ${quote.lead_email || ''}, ${quote.lead_phone || ''}, ${JSON.stringify(quote.items || [])}, ${quote.subtotal || 0}, ${quote.discount || 0}, ${quote.total || 0}, ${quote.notes || ''}, ${quote.status || 'rascunho'}, ${quote.sent_at || null}, ${quote.attachment_url || ''}, ${quote.created_at}, ${quote.updated_at})
    ON CONFLICT (id) DO UPDATE SET
      lead_name = EXCLUDED.lead_name, lead_company = EXCLUDED.lead_company,
      lead_email = EXCLUDED.lead_email, lead_phone = EXCLUDED.lead_phone,
      items = EXCLUDED.items, subtotal = EXCLUDED.subtotal, discount = EXCLUDED.discount,
      total = EXCLUDED.total, notes = EXCLUDED.notes, status = EXCLUDED.status,
      sent_at = EXCLUDED.sent_at, attachment_url = EXCLUDED.attachment_url, updated_at = EXCLUDED.updated_at;
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
    INSERT INTO templates (id, workspace, name, type, subject, body, tags, attachment_url, created_at, updated_at)
    VALUES (${t.id}, ${t.workspace}, ${t.name}, ${t.type}, ${t.subject || ''}, ${t.body}, ${t.tags || ''}, ${t.attachment_url || ''}, ${t.created_at || Date.now()}, ${t.updated_at || Date.now()})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, type = EXCLUDED.type, subject = EXCLUDED.subject,
      body = EXCLUDED.body, tags = EXCLUDED.tags, attachment_url = EXCLUDED.attachment_url, updated_at = EXCLUDED.updated_at;
  `;
  return t;
}

export async function deleteTemplate(id: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM templates WHERE id = ${id};`;
  return { id };
}

// ---- Agente de Prospecção Automática ----
export async function initAgentTables() {
  if (!hasDatabase) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS agent_config (
        workspace TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT false,
        industry TEXT DEFAULT 'logistica',
        source TEXT DEFAULT 'cnpja',
        daily_limit INTEGER DEFAULT 10,
        email_template TEXT DEFAULT '',
        email_subject TEXT DEFAULT '',
        send_email BOOLEAN DEFAULT true,
        last_run BIGINT,
        updated_at BIGINT
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        started_at BIGINT NOT NULL,
        finished_at BIGINT,
        status TEXT DEFAULT 'running',
        leads_found INTEGER DEFAULT 0,
        leads_imported INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        log TEXT DEFAULT ''
      );
    `;
    // Adicionar coluna source se não existir (migration segura)
    try { await sql`ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cnpja';`; } catch {}
  } catch {}
}

export async function getAgentConfig(workspace: string) {
  if (!hasDatabase) return null;
  try {
    const { rows } = await sql`SELECT * FROM agent_config WHERE workspace = ${workspace};`;
    return rows[0] || null;
  } catch { return null; }
}

export async function upsertAgentConfig(config: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO agent_config (workspace, enabled, industry, source, daily_limit, email_template, email_subject, send_email, last_run, updated_at)
    VALUES (${config.workspace}, ${config.enabled ?? false}, ${config.industry || 'logistica'}, ${config.source || 'cnpja'}, ${config.daily_limit || 10}, ${config.email_template || ''}, ${config.email_subject || ''}, ${config.send_email ?? true}, ${config.last_run || null}, ${Date.now()})
    ON CONFLICT (workspace) DO UPDATE SET
      enabled = EXCLUDED.enabled, industry = EXCLUDED.industry, source = EXCLUDED.source,
      daily_limit = EXCLUDED.daily_limit, email_template = EXCLUDED.email_template,
      email_subject = EXCLUDED.email_subject, send_email = EXCLUDED.send_email,
      last_run = EXCLUDED.last_run, updated_at = EXCLUDED.updated_at;
  `;
  return config;
}

export async function insertAgentRun(run: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO agent_runs (id, workspace, started_at, finished_at, status, leads_found, leads_imported, emails_sent, errors, log)
    VALUES (${run.id}, ${run.workspace}, ${run.started_at}, ${run.finished_at || null}, ${run.status || 'running'}, ${run.leads_found || 0}, ${run.leads_imported || 0}, ${run.emails_sent || 0}, ${run.errors || 0}, ${run.log || ''});
  `;
  return run;
}

export async function updateAgentRun(id: string, updates: any) {
  if (!hasDatabase) return null;
  await sql`
    UPDATE agent_runs SET
      finished_at = ${updates.finished_at || null},
      status = ${updates.status || 'done'},
      leads_found = ${updates.leads_found || 0},
      leads_imported = ${updates.leads_imported || 0},
      emails_sent = ${updates.emails_sent || 0},
      errors = ${updates.errors || 0},
      log = ${updates.log || ''}
    WHERE id = ${id};
  `;
  return { id, ...updates };
}

export async function getAgentRuns(workspace: string, limit = 20) {
  if (!hasDatabase) return [];
  try {
    const { rows } = await sql`
      SELECT * FROM agent_runs WHERE workspace = ${workspace} ORDER BY started_at DESC LIMIT ${limit};
    `;
    return rows;
  } catch { return []; }
}

export async function getLeadEmails(workspace: string): Promise<string[]> {
  if (!hasDatabase) return [];
  try {
    const { rows } = await sql`SELECT email FROM leads WHERE workspace = ${workspace} AND email != '' AND email IS NOT NULL;`;
    return rows.map((r: any) => r.email).filter(Boolean);
  } catch { return []; }
}

// ---- Painel do Gestor: Metas e Sugestões ----
export async function initGestorTables() {
  if (!hasDatabase) return;
  try {
    // Tabela de metas diárias
    await sql`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        whatsapp_goal INTEGER DEFAULT 20,
        email_goal INTEGER DEFAULT 20,
        call_goal INTEGER DEFAULT 10,
        total_goal INTEGER DEFAULT 50,
        created_by TEXT DEFAULT 'vandir',
        updated_at BIGINT
      );
    `;
    // Tabela de sugestões/feedbacks do gestor
    await sql`
      CREATE TABLE IF NOT EXISTS manager_suggestions (
        id TEXT PRIMARY KEY,
        workspace TEXT NOT NULL,
        message TEXT NOT NULL,
        from_name TEXT DEFAULT 'Vandir',
        priority TEXT DEFAULT 'normal',
        read_at BIGINT,
        created_at BIGINT
      );
    `;
    // Inserir metas padrão se não existirem
    await sql`
      INSERT INTO daily_goals (id, workspace, whatsapp_goal, email_goal, call_goal, total_goal, updated_at)
      VALUES ('lottus-goals', 'lottus', 20, 20, 10, 50, ${Date.now()})
      ON CONFLICT (id) DO NOTHING;
    `;
  } catch (e) { console.error('initGestorTables error:', e); }
}

export async function getDailyGoals(workspace: string) {
  if (!hasDatabase) return { whatsapp_goal: 20, email_goal: 20, call_goal: 10, total_goal: 50 };
  try {
    const { rows } = await sql`SELECT * FROM daily_goals WHERE workspace = ${workspace} LIMIT 1;`;
    return rows[0] || { whatsapp_goal: 20, email_goal: 20, call_goal: 10, total_goal: 50 };
  } catch { return { whatsapp_goal: 20, email_goal: 20, call_goal: 10, total_goal: 50 }; }
}

export async function upsertDailyGoals(workspace: string, goals: any) {
  if (!hasDatabase) return goals;
  await sql`
    INSERT INTO daily_goals (id, workspace, whatsapp_goal, email_goal, call_goal, total_goal, updated_at)
    VALUES (${workspace + '-goals'}, ${workspace}, ${goals.whatsapp_goal || 20}, ${goals.email_goal || 20}, ${goals.call_goal || 10}, ${goals.total_goal || 50}, ${Date.now()})
    ON CONFLICT (id) DO UPDATE SET
      whatsapp_goal = EXCLUDED.whatsapp_goal,
      email_goal = EXCLUDED.email_goal,
      call_goal = EXCLUDED.call_goal,
      total_goal = EXCLUDED.total_goal,
      updated_at = EXCLUDED.updated_at;
  `;
  return goals;
}

export async function getManagerSuggestions(workspace: string) {
  if (!hasDatabase) return [];
  try {
    const { rows } = await sql`SELECT * FROM manager_suggestions WHERE workspace = ${workspace} ORDER BY created_at DESC LIMIT 50;`;
    return rows;
  } catch { return []; }
}

export async function insertManagerSuggestion(suggestion: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO manager_suggestions (id, workspace, message, from_name, priority, created_at)
    VALUES (${suggestion.id}, ${suggestion.workspace}, ${suggestion.message}, ${suggestion.from_name || 'Vandir'}, ${suggestion.priority || 'normal'}, ${Date.now()});
  `;
  return suggestion;
}

export async function markSuggestionRead(id: string) {
  if (!hasDatabase) return null;
  await sql`UPDATE manager_suggestions SET read_at = ${Date.now()} WHERE id = ${id};`;
  return { id };
}
