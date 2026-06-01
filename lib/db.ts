import { sql } from '@vercel/postgres';

// Detecta se há banco Postgres configurado (variáveis de ambiente do Vercel)
export const hasDatabase = !!(
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL
);

// Cria a tabela de leads se ainda não existir
export async function initDatabase() {
  if (!hasDatabase) return { ok: false, reason: 'no-database' };
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
      created_at BIGINT,
      updated_at BIGINT
    );
  `;
  return { ok: true };
}

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
    INSERT INTO leads (id, workspace, name, company, role, email, whatsapp, linkedin, phone, source, notes, status, created_at, updated_at)
    VALUES (${lead.id}, ${lead.workspace}, ${lead.name}, ${lead.company}, ${lead.role}, ${lead.email}, ${lead.whatsapp}, ${lead.linkedin}, ${lead.phone}, ${lead.source}, ${lead.notes}, ${lead.status}, ${lead.created_at}, ${lead.updated_at})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, company = EXCLUDED.company, role = EXCLUDED.role,
      email = EXCLUDED.email, whatsapp = EXCLUDED.whatsapp, linkedin = EXCLUDED.linkedin,
      phone = EXCLUDED.phone, source = EXCLUDED.source, notes = EXCLUDED.notes,
      status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
  `;
  return lead;
}

export async function deleteLead(id: string) {
  if (!hasDatabase) return null;
  await sql`DELETE FROM leads WHERE id = ${id};`;
  return { id };
}
