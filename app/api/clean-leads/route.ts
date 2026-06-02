import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Extrai número de telefone de uma string suja
function extractPhone(str: string): string {
  if (!str) return '';
  const match = str.match(/(?:55\s*)?(\d{2})\s*(\d{4,5})[-\s]?(\d{4})/);
  if (match) {
    return `55${match[1]}${match[2]}${match[3]}`;
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  return '';
}

// Limpa o campo empresa: remove cargo, telefone, "Enviado whatss", vírgulas
function cleanCompany(company: string): string {
  if (!company) return '';
  let clean = company
    .replace(/,?\s*Enviado\s*what[sz]+s?/gi, '')
    .replace(/,?\s*55\s*\d{2}\s*\d{4,5}[-\s]?\d{4}/g, '')
    .replace(/,?\s*\d{2}\s*\d{4,5}[-\s]?\d{4}/g, '')
    .replace(/,?\s*(Gerente|Diretor|Coordenador|Controller|CEO|CFO|Supervisor|Analista|Comprador|Logistica|Logística|Senior)[^,]*/gi, '')
    .replace(/,?\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '') // remove e-mails
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!clean || /^[,\s]+$/.test(clean) || clean === '0') return '';
  return clean;
}

// Extrai e-mail de uma string suja
function extractEmail(str: string): string {
  if (!str) return '';
  const found = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (found) {
    const candidate = found[0].toLowerCase();
    if (candidate.match(/@[^@]*\d{6,}/)) return '';
    return candidate;
  }
  return '';
}

// Verifica se o nome está sujo (foi alterado erroneamente pela limpeza anterior)
function isNameDirty(name: string): boolean {
  return (
    name.includes('@') ||
    /55\s*\d{2}\s*\d{4,5}/i.test(name) ||
    /Enviado\s*what/i.test(name) ||
    name === '0' ||
    /^[,\s0]+$/.test(name)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspace = body.workspace || 'lottus';

    const { rows } = await sql`
      SELECT id, name, company, role, email, whatsapp, phone, notes
      FROM leads
      WHERE workspace = ${workspace}
      ORDER BY created_at DESC
    `;

    let fixed = 0;
    let skipped = 0;
    const log: string[] = [];

    for (const lead of rows) {
      const originalName = lead.name || '';
      const originalCompany = lead.company || '';
      const originalEmail = lead.email || '';
      const originalPhone = lead.phone || '';
      const originalWhatsapp = lead.whatsapp || '';
      const originalRole = lead.role || '';

      let newName = originalName;
      let newCompany = originalCompany;
      let newEmail = originalEmail;
      let newPhone = originalPhone;
      let newWhatsapp = originalWhatsapp;
      let newRole = originalRole;
      let changed = false;

      // 1. Corrigir nome sujo (alterado pela limpeza anterior)
      if (isNameDirty(originalName)) {
        // Se o nome tem e-mail, extrai o e-mail e usa o cargo como nome
        if (originalName.includes('@')) {
          const emailFromName = extractEmail(originalName);
          if (emailFromName && !newEmail) newEmail = emailFromName;
          // Nome vira o cargo ou "Contato"
          newName = originalRole || 'Contato';
        } else if (originalName === '0' || /^[,\s0]+$/.test(originalName)) {
          newName = originalRole || 'Contato sem nome';
        }
        changed = true;
      }

      // 2. Limpar campo empresa (company) que ficou com lixo
      const companyDirty =
        /55\s*\d{2}\s*\d{4,5}/i.test(originalCompany) ||
        /Enviado\s*what/i.test(originalCompany) ||
        /,\s*(Gerente|Diretor|Coordenador|Controller|CEO|CFO|Analista)/i.test(originalCompany) ||
        originalCompany.startsWith(',') ||
        originalCompany === '0';

      if (companyDirty) {
        // Extrai telefone da empresa se não tiver
        if (!newPhone) newPhone = extractPhone(originalCompany);
        if (!newWhatsapp) newWhatsapp = extractPhone(originalCompany);
        // Extrai e-mail da empresa se não tiver
        if (!newEmail) newEmail = extractEmail(originalCompany);
        // Extrai cargo da empresa se não tiver
        if (!newRole) {
          const roleMatch = originalCompany.match(/,\s*(Gerente[^,]*|Diretor[^,]*|Coordenador[^,]*|Controller[^,]*|CEO[^,]*|CFO[^,]*|Analista[^,]*)/i);
          if (roleMatch) newRole = roleMatch[1].trim();
        }
        newCompany = cleanCompany(originalCompany);
        changed = true;
      }

      if (!changed) { skipped++; continue; }

      await sql`
        UPDATE leads SET
          name = ${newName},
          company = ${newCompany},
          role = ${newRole},
          phone = ${newPhone},
          whatsapp = ${newWhatsapp},
          email = ${newEmail},
          updated_at = ${Date.now()}
        WHERE id = ${lead.id}
      `;

      log.push(`✓ "${originalName.slice(0,30)}" | empresa: "${originalCompany.slice(0,30)}" → "${newCompany}" | tel: ${newPhone} | email: ${newEmail}`);
      fixed++;
    }

    return NextResponse.json({ ok: true, total: rows.length, fixed, skipped, log: log.slice(0, 60) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
