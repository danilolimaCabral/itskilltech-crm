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
  try { await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`; } catch {}
  try { await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';`; } catch {}

  // Inserir workspaces padrão se não existirem
  await sql`
    INSERT INTO workspaces (id, name, color, created_at)
    VALUES
      ('lottus', 'Lottus Tech', '#0066ff', ${Date.now()}),
      ('iota', 'IOTA', '#6938ef', ${Date.now()}),
      ('splitc', 'SPLITC', '#079455', ${Date.now()})
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
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS state TEXT;`; } catch {}
  try { await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry TEXT;`; } catch {}

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

  // Usuários por empresa e sessões revogáveis. Senhas são armazenadas apenas como hash PBKDF2.
  await sql`
    CREATE TABLE IF NOT EXISTS tenant_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      workspace TEXT NOT NULL REFERENCES workspaces(id),
      role TEXT NOT NULL DEFAULT 'operator',
      active BOOLEAN DEFAULT true,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS crm_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
      workspace TEXT NOT NULL REFERENCES workspaces(id),
      role TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );
  `;
  // Códigos temporários de recuperação de acesso
  await sql`
    CREATE TABLE IF NOT EXISTS password_recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      used_at BIGINT,
      created_at BIGINT NOT NULL
    );
  `;

  // Conta administrativa legada migrada para hash não reversível. A senha original não permanece no código.
  await sql`
    INSERT INTO tenant_users (id, username, password_hash, display_name, workspace, role, active, created_at, updated_at)
    VALUES ('usr_danilo_master', 'danilo', 'pbkdf2$210000$7ZZeEGBTe9SHEJK01F7RMw$UAOatwE1NikxJ1nsAOcAan1wqGFYzVM03D7MeUrqZVk', 'Danilo Cabral', 'lottus', 'master', true, ${Date.now()}, ${Date.now()})
    ON CONFLICT (username) DO NOTHING;
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

export async function getWorkspace(id: string) {
  if (!hasDatabase) return null;
  const { rows } = await sql`SELECT * FROM workspaces WHERE id = ${id} LIMIT 1;`;
  return rows[0] || null;
}

// ---- Usuários e sessões multiempresa ----
export async function getTenantUserByUsername(username: string) {
  if (!hasDatabase) return null;
  const { rows } = await sql`SELECT * FROM tenant_users WHERE username = ${username.toLowerCase()} LIMIT 1;`;
  return rows[0] || null;
}

export async function listTenantUsers() {
  if (!hasDatabase) return [];
  const { rows } = await sql`
    SELECT u.id, u.username, u.display_name, u.workspace, u.role, u.active, u.created_at, w.name AS workspace_name
    FROM tenant_users u
    LEFT JOIN workspaces w ON w.id = u.workspace
    ORDER BY u.created_at ASC;
  `;
  return rows;
}

export async function insertTenantUser(user: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO tenant_users (id, username, password_hash, display_name, workspace, role, active, created_at, updated_at)
    VALUES (${user.id}, ${user.username.toLowerCase()}, ${user.password_hash}, ${user.display_name}, ${user.workspace}, ${user.role || 'operator'}, ${user.active ?? true}, ${user.created_at || Date.now()}, ${Date.now()});
  `;
  return user;
}

export async function createTenantSession(session: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO crm_sessions (id, token_hash, user_id, workspace, role, expires_at, created_at)
    VALUES (${session.id}, ${session.token_hash}, ${session.user_id}, ${session.workspace}, ${session.role}, ${session.expires_at}, ${session.created_at});
  `;
  return session;
}

export async function getTenantSessionByTokenHash(tokenHash: string) {
  if (!hasDatabase) return null;
  const { rows } = await sql`
    SELECT s.id, s.user_id, s.workspace, s.role, s.expires_at, u.username, u.display_name, u.active
    FROM crm_sessions s
    INNER JOIN tenant_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1;
  `;
  return rows[0] || null;
}

export async function deleteTenantSession(tokenHash: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM crm_sessions WHERE token_hash = ${tokenHash};`;
  return true;
}

export async function createPasswordRecoveryCode(record: { id: string; user_id: string; code_hash: string; expires_at: number; created_at: number }) {
  if (!hasDatabase) return null;
  await sql`INSERT INTO password_recovery_codes (id, user_id, code_hash, expires_at, created_at) VALUES (${record.id}, ${record.user_id}, ${record.code_hash}, ${record.expires_at}, ${record.created_at});`;
  return record;
}

export async function getPasswordRecoveryCode(id: string) {
  if (!hasDatabase) return null;
  const { rows } = await sql`SELECT * FROM password_recovery_codes WHERE id = ${id} LIMIT 1;`;
  return rows[0] || null;
}

export async function usePasswordRecoveryCode(id: string) {
  if (!hasDatabase) return null;
  await sql`UPDATE password_recovery_codes SET used_at = ${Date.now()} WHERE id = ${id} AND used_at IS NULL;`;
  return true;
}

export async function updateTenantUserPassword(userId: string, passwordHash: string) {
  if (!hasDatabase) return null;
  await sql`UPDATE tenant_users SET password_hash = ${passwordHash}, updated_at = ${Date.now()} WHERE id = ${userId};`;
  return true;
}

// ---- Leads ----
export async function getLeads(workspace: string) {
  if (!hasDatabase) return [];
  const { rows } = await sql`
    SELECT * FROM leads WHERE workspace = ${workspace} ORDER BY created_at ASC;
  `;
  return rows;
}

export async function upsertLead(lead: any) {
  if (!hasDatabase) return null;
  await sql`
    INSERT INTO leads (id, workspace, name, company, role, email, whatsapp, linkedin, phone, source, notes, status, call_count, last_contact, next_call_at, gestor_note, created_at, updated_at, state, industry)
    VALUES (${lead.id}, ${lead.workspace}, ${lead.name}, ${lead.company || ''}, ${lead.role || ''}, ${lead.email || ''}, ${lead.whatsapp || ''}, ${lead.linkedin || ''}, ${lead.phone || ''}, ${lead.source || ''}, ${lead.notes || ''}, ${lead.status || 'novo'}, ${lead.call_count || 0}, ${lead.last_contact || null}, ${lead.next_call_at || null}, ${lead.gestor_note || ''}, ${lead.created_at}, ${lead.updated_at}, ${lead.state || ''}, ${lead.industry || ''})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, company = EXCLUDED.company, role = EXCLUDED.role,
      email = EXCLUDED.email, whatsapp = EXCLUDED.whatsapp, linkedin = EXCLUDED.linkedin,
      phone = EXCLUDED.phone, source = EXCLUDED.source, notes = EXCLUDED.notes,
      status = EXCLUDED.status, call_count = EXCLUDED.call_count,
      last_contact = EXCLUDED.last_contact, next_call_at = EXCLUDED.next_call_at, gestor_note = EXCLUDED.gestor_note, updated_at = EXCLUDED.updated_at,
      state = EXCLUDED.state, industry = EXCLUDED.industry;
  `;
  return lead;
}

export async function deleteLead(id: string, workspace?: string) {
  if (!hasDatabase) return null;
  if (workspace) await sql`DELETE FROM leads WHERE id = ${id} AND workspace = ${workspace};`;
  else await sql`DELETE FROM leads WHERE id = ${id};`;
  return { id };
}

// ---- Ligações ----
export async function getCallLogs(leadId: string, workspace?: string) {
  if (!hasDatabase) return [];
  const { rows } = workspace
    ? await sql`SELECT * FROM call_logs WHERE lead_id = ${leadId} AND workspace = ${workspace} ORDER BY created_at DESC;`
    : await sql`SELECT * FROM call_logs WHERE lead_id = ${leadId} ORDER BY created_at DESC;`;
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

export async function deleteQuote(id: string, workspace?: string) {
  if (!hasDatabase) return null;
  if (workspace) await sql`DELETE FROM quotes WHERE id = ${id} AND workspace = ${workspace};`;
  else await sql`DELETE FROM quotes WHERE id = ${id};`;
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

export async function deleteTemplate(id: string, workspace?: string) {
  if (!hasDatabase) return null;
  if (workspace) await sql`DELETE FROM templates WHERE id = ${id} AND workspace = ${workspace};`;
  else await sql`DELETE FROM templates WHERE id = ${id};`;
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
