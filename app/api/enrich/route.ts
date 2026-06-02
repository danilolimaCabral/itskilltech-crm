import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const APOLLO_KEY = process.env.APOLLO_API_KEY || '';
const CNPJA_KEY  = process.env.CNPJA_API_KEY || '';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) return formatPhone(digits.slice(2));
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  return raw;
}

function extractDomain(website: string): string {
  if (!website) return '';
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function guessEmails(domain: string): string[] {
  if (!domain) return [];
  return ['contato', 'comercial', 'vendas', 'financeiro', 'ti'].map(p => `${p}@${domain}`);
}

// ─── Apollo: busca organização por nome ─────────────────────────────────────

async function apolloSearchOrg(companyName: string) {
  if (!APOLLO_KEY || APOLLO_KEY.startsWith('sua_chave')) return null;
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
      body: JSON.stringify({
        q_organization_name: companyName,
        organization_locations: ['Brazil'],
        page: 1, per_page: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error('[enrich] Apollo org HTTP', res.status); return null; }
    const data = await res.json();
    const org = data?.organizations?.[0] || data?.accounts?.[0];
    if (!org) return null;
    return {
      domain: org.primary_domain || extractDomain(org.website_url || ''),
      phone: org.primary_phone?.number || org.sanitized_phone || '',
      website: org.website_url || '',
      linkedin: org.linkedin_url || '',
      industry: org.industry || '',
      city: org.city || '',
      state: org.state || '',
      employees: org.estimated_num_employees || 0,
    };
  } catch (e: any) { console.error('[enrich] Apollo org error:', e?.message); return null; }
}

// ─── Apollo: busca decisor (CEO/Diretor/Gerente) ────────────────────────────

async function apolloFindDecisionMaker(domain: string, companyName: string) {
  if (!APOLLO_KEY || APOLLO_KEY.startsWith('sua_chave')) return null;
  try {
    const body: Record<string, any> = {
      page: 1, per_page: 5,
      person_titles: [
        'CEO', 'Diretor', 'Diretor Comercial', 'Diretor de TI', 'Gerente Comercial',
        'Gerente de TI', 'CTO', 'COO', 'Sócio', 'Proprietário', 'Fundador',
        'Chief Executive Officer', 'Chief Technology Officer', 'Director', 'VP',
      ],
      organization_locations: ['Brazil'],
      reveal_personal_emails: false,
      reveal_phone_number: true,
    };
    if (domain) body.q_organization_domains = [domain];
    else body.q_organization_name = companyName;

    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error('[enrich] Apollo people HTTP', res.status); return null; }
    const data = await res.json();
    const people = data?.people || [];
    if (!people.length) return null;

    // Prioriza quem tem e-mail verificado
    const best = people.find((p: any) => p.email && p.email_status === 'verified') || people[0];
    const phone = best?.phone_numbers?.[0]?.sanitized_number
      || best?.phone_numbers?.[0]?.raw_number
      || best?.organization?.primary_phone?.number || '';
    return {
      name: best.name || `${best.first_name || ''} ${best.last_name || ''}`.trim(),
      title: best.title || '',
      email: best.email || '',
      phone: formatPhone(phone),
      linkedin: best.linkedin_url || '',
    };
  } catch (e: any) { console.error('[enrich] Apollo people error:', e?.message); return null; }
}

// ─── Fallback: BrasilAPI / MinhaReceita via CNPJ ────────────────────────────

async function enrichByCNPJ(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '');
  for (const url of [
    `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
    `https://minhareceita.org/${clean}`,
  ]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const d = await res.json();
      const tel1 = (d.ddd_telefone_1 || d.telefone || '').toString().trim();
      const tel2 = (d.ddd_telefone_2 || '').toString().trim();
      return {
        telefone: formatPhone(tel1),
        telefone2: formatPhone(tel2),
        email: (d.email || '').toLowerCase(),
        municipio: d.municipio || d.municipio_nome || '',
        uf: d.uf || '',
        razao_social: d.razao_social || d.nome || '',
        source: url.includes('brasilapi') ? 'BrasilAPI (CNPJ)' : 'MinhaReceita (CNPJ)',
      };
    } catch {}
  }
  return null;
}

// ─── Busca CNPJ por nome via CNPJ.já ────────────────────────────────────────

async function findCNPJByName(name: string): Promise<string | null> {
  if (!CNPJA_KEY) return null;
  try {
    const res = await fetch(
      `https://api.cnpja.com/office/search?company=${encodeURIComponent(name)}&limit=1`,
      { headers: { Authorization: CNPJA_KEY }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const cnpj = data?.data?.[0]?.taxId || data?.offices?.[0]?.taxId;
    return cnpj ? cnpj.replace(/\D/g, '') : null;
  } catch { return null; }
}

// ─── Handler principal ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, cnpj: providedCnpj, website } = body;

    if (!company && !providedCnpj) {
      return NextResponse.json({ ok: false, error: 'Informe company ou cnpj' }, { status: 400 });
    }

    const apolloAvailable = !!(APOLLO_KEY && !APOLLO_KEY.startsWith('sua_chave'));
    const result: Record<string, any> = {
      ok: true,
      telefone: '',
      email: '',
      contact_name: '',
      contact_title: '',
      contact_linkedin: '',
      website: website || '',
      municipio: '',
      uf: '',
      source: '',
      sources_tried: [] as string[],
    };

    let domain = website ? extractDomain(website) : '';

    // ── 1. Apollo: busca organização ──────────────────────────────────────────
    if (apolloAvailable) {
      result.sources_tried.push('Apollo (empresa)');
      const orgData = await apolloSearchOrg(company);
      if (orgData) {
        if (orgData.phone) result.telefone = formatPhone(orgData.phone);
        if (!domain && orgData.domain) domain = orgData.domain;
        if (!result.website && orgData.website) result.website = orgData.website;
        if (orgData.city) result.municipio = orgData.city;
        if (orgData.state) result.uf = orgData.state;
        result.source = 'Apollo.io (empresa)';
      }

      // ── 2. Apollo: busca decisor ───────────────────────────────────────────
      result.sources_tried.push('Apollo (decisor)');
      const person = await apolloFindDecisionMaker(domain, company);
      if (person) {
        if (person.email) result.email = person.email;
        if (person.phone) {
          if (!result.telefone) result.telefone = person.phone;
          else result.telefone2 = person.phone;
        }
        if (person.name) result.contact_name = person.name;
        if (person.title) result.contact_title = person.title;
        if (person.linkedin) result.contact_linkedin = person.linkedin;
        result.source = 'Apollo.io (decisor)';
      }
    }

    // ── 3. Fallback: BrasilAPI/MinhaReceita via CNPJ ──────────────────────────
    if (!result.telefone || !result.email) {
      let cnpj = providedCnpj || null;
      if (!cnpj && company) {
        result.sources_tried.push('CNPJ.já (busca)');
        cnpj = await findCNPJByName(company);
      }
      if (cnpj) {
        result.sources_tried.push('BrasilAPI/MinhaReceita');
        const cnpjData = await enrichByCNPJ(cnpj);
        if (cnpjData) {
          if (!result.telefone && cnpjData.telefone) result.telefone = cnpjData.telefone;
          if (!result.email && cnpjData.email) result.email = cnpjData.email;
          if (!result.municipio && cnpjData.municipio) result.municipio = cnpjData.municipio;
          if (!result.uf && cnpjData.uf) result.uf = cnpjData.uf;
          if (!result.source) result.source = cnpjData.source;
        }
      }
    }

    // ── 4. Fallback: sugestão de e-mail por padrão de domínio ─────────────────
    if (!result.email && domain) {
      result.suggested_emails = guessEmails(domain);
      result.email = result.suggested_emails[0];
      result.email_is_guess = true;
      if (!result.source) result.source = 'Padrão de domínio (sugestão)';
    }

    if (!result.telefone && !result.email) {
      return NextResponse.json({
        ok: false,
        error: `Dados não encontrados para "${company}". Tente informar o site da empresa.`,
        sources_tried: result.sources_tried,
      });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
