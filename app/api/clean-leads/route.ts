import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Extrai número de telefone de uma string suja
function extractPhone(str: string): string {
  if (!str) return '';
  // Procura padrão: 55 XX XXXXX-XXXX ou 55XXXXXXXXXX ou (XX) XXXXX-XXXX
  const match = str.match(/(?:55\s*)?(\d{2})\s*(\d{4,5})[-\s]?(\d{4})/);
  if (match) {
    const ddd = match[1];
    const part1 = match[2];
    const part2 = match[3];
    return `55${ddd}${part1}${part2}`;
  }
  // Tenta extrair só dígitos
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 10) return digits;
  return '';
}

// Limpa e-mail de strings sujas como "contato@controller5547991659972enviadowhatss.com"
function cleanEmail(email: string): string {
  if (!email) return '';
  // Remove sufixos de rastreamento como "enviadowhatss", números no domínio etc.
  // Verifica se é um e-mail válido
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (validEmail && !email.match(/\d{7,}/)) return email.toLowerCase().trim();
  // Tenta extrair um e-mail real da string
  const found = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (found) {
    const candidate = found[0].toLowerCase();
    // Rejeita e-mails com muitos números no domínio (gerados automaticamente)
    if (candidate.match(/@[^@]*\d{6,}/)) return '';
    return candidate;
  }
  return '';
}

// Limpa o nome: remove cargo, telefone, "Enviado whatss" etc.
function cleanName(name: string): string {
  if (!name) return '';
  // Remove padrões comuns de lixo
  let clean = name
    .replace(/,?\s*Enviado\s*what[sz]+s?/gi, '')
    .replace(/,?\s*55\s*\d{2}\s*\d{4,5}[-\s]?\d{4}/g, '') // telefone
    .replace(/,?\s*\d{2}\s*\d{4,5}[-\s]?\d{4}/g, '') // telefone sem 55
    .replace(/,\s*(Gerente|Diretor|Coordenador|Controller|CEO|CFO|Supervisor|Analista|Comprador|Logistica|Logística)[^,]*/gi, '') // cargo no nome
    .replace(/^\s*,\s*/, '') // vírgula no início
    .replace(/\s*,\s*$/, '') // vírgula no final
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Se ficou vazio ou só tem vírgulas/espaços, retorna vazio
  if (!clean || /^[,\s]+$/.test(clean)) return '';
  return clean;
}

// Extrai cargo de uma string que mistura nome+cargo+telefone
function extractRole(str: string): string {
  if (!str) return '';
  const roleMatch = str.match(/,\s*(Gerente[^,]*|Diretor[^,]*|Coordenador[^,]*|Controller[^,]*|CEO[^,]*|CFO[^,]*|Supervisor[^,]*|Analista[^,]*|Comprador[^,]*)/i);
  if (roleMatch) return roleMatch[1].trim();
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspace = body.workspace || 'lottus';

    // Busca todos os leads do workspace
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
      const originalEmail = lead.email || '';
      const originalPhone = lead.phone || '';
      const originalWhatsapp = lead.whatsapp || '';
      const originalRole = lead.role || '';

      // Detecta se o nome está sujo (contém telefone, "Enviado whatss", cargo misturado)
      const nameDirty =
        /55\s*\d{2}\s*\d{4,5}/i.test(originalName) ||
        /Enviado\s*what/i.test(originalName) ||
        /,\s*(Gerente|Diretor|Coordenador|Controller|CEO|CFO)/i.test(originalName) ||
        originalName.startsWith(',');

      // Detecta e-mail gerado automaticamente (com muitos números)
      const emailDirty = originalEmail && (
        /\d{7,}/.test(originalEmail) ||
        /enviadowhat/i.test(originalEmail) ||
        !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(originalEmail)
      );

      if (!nameDirty && !emailDirty) {
        skipped++;
        continue;
      }

      // Extrai cargo do nome sujo (se não tiver cargo ainda)
      const extractedRole = !originalRole && nameDirty ? extractRole(originalName) : originalRole;

      // Extrai telefone do nome sujo (se não tiver telefone)
      const extractedPhone = !originalPhone && nameDirty ? extractPhone(originalName) : originalPhone;
      const extractedWhatsapp = !originalWhatsapp && nameDirty ? extractPhone(originalName) : originalWhatsapp;

      // Limpa o nome
      const newName = nameDirty ? cleanName(originalName) : originalName;

      // Limpa o e-mail
      const newEmail = emailDirty ? cleanEmail(originalEmail) : originalEmail;

      // Se o nome ficou vazio após limpeza, usa o cargo como fallback ou "Contato sem nome"
      const finalName = newName || extractedRole || 'Contato sem nome';

      // Só atualiza se algo mudou
      if (
        finalName === originalName &&
        newEmail === originalEmail &&
        extractedRole === originalRole &&
        extractedPhone === originalPhone
      ) {
        skipped++;
        continue;
      }

      await sql`
        UPDATE leads SET
          name = ${finalName},
          role = ${extractedRole || originalRole || ''},
          phone = ${extractedPhone || originalPhone || ''},
          whatsapp = ${extractedWhatsapp || originalWhatsapp || ''},
          email = ${newEmail || ''},
          updated_at = ${Date.now()}
        WHERE id = ${lead.id}
      `;

      log.push(`✓ ${originalName.slice(0, 40)} → "${newName}" | cargo: ${extractedRole} | tel: ${extractedPhone} | email: ${newEmail}`);
      fixed++;
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      fixed,
      skipped,
      log: log.slice(0, 50),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
