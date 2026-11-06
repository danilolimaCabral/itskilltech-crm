import { NextRequest, NextResponse } from 'next/server';
import { getLeads } from '@/lib/db';
import { getSession, resolveWorkspace } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';

const INDUSTRY_MAP: Record<string, string[]> = {
  logistica: ['logistics and supply chain', 'supply chain', 'warehousing', 'transportation'],
  transporte: ['transportation', 'trucking', 'freight', 'cargo'],
  tecnologia: ['information technology and services', 'software development', 'computer software', 'saas'],
  ti: ['information technology and services', 'computer & network security', 'computer software'],
  software: ['computer software', 'software development', 'saas'],
  varejo: ['retail', 'wholesale', 'supermarkets'],
  saude: ['hospital & health care', 'medical devices', 'pharmaceuticals'],
  educacao: ['e-learning', 'education management', 'higher education'],
  marketing: ['marketing and advertising', 'public relations and communications'],
  consultoria: ['management consulting', 'business supplies and equipment'],
  industria: ['industrial automation', 'machinery', 'manufacturing', 'mechanical engineering'],
  construcao: ['construction', 'civil engineering', 'building materials'],
  alimentacao: ['food & beverages', 'food production', 'wholesale food', 'food distribution', 'food and beverage', 'packaged foods'],
  atacado: ['wholesale', 'wholesale food', 'wholesale food & beverage', 'food distribution', 'beverage distribution', 'consumer goods distribution'],
  distribuidor: ['wholesale', 'food distribution', 'beverage distribution', 'consumer goods distribution', 'logistics and supply chain'],
  agro: ['farming', 'agriculture', 'food production'],
  financeiro: ['financial services', 'banking', 'investment management'],
};

function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bs\.?a\.?\b/g, '')
    .replace(/\bltda\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeCountry(value: unknown): string {
  const country = String(value || 'Brazil').trim();
  const normalized = country.toLowerCase();
  if (normalized === 'brasil' || normalized === 'brazil') return 'Brazil';
  if (normalized === 'estados unidos' || normalized === 'united states' || normalized === 'usa') return 'United States';
  if (normalized === 'portugal') return 'Portugal';
  return country;
}

function normalizeDomain(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0];
}

function isDomain(value: string): boolean {
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(normalizeDomain(value));
}

function appendArrayParams(params: URLSearchParams, key: string, values: string[]): void {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (trimmed) params.append(`${key}[]`, trimmed);
  }
}

async function responseJson(response: Response): Promise<Record<string, any>> {
  try {
    const value = await response.json();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function getPersonTitles(department: string, level: string): string[] {
  const titlesByDept: Record<string, string[]> = {
    ti: ['Director of IT', 'Diretor de TI', 'CIO', 'CTO', 'Chief Technology Officer', 'IT Manager', 'Gerente de TI', 'Head of IT', 'Coordenador de TI'],
    logistica: ['Diretor de Logística', 'Diretor de Supply Chain', 'Logistics Director', 'Supply Chain Director', 'Gerente de Logística', 'Logistics Manager', 'Gerente de Supply Chain', 'Supply Chain Manager', 'Head of Logistics', 'Coordenador de Logística'],
    operacoes: ['COO', 'Chief Operating Officer', 'Diretor de Operações', 'Director of Operations', 'Gerente de Operações', 'Operations Manager', 'Head of Operations', 'Diretor Operacional'],
    comercial: ['Diretor Comercial', 'Sales Director', 'Gerente Comercial', 'Sales Manager', 'Head of Sales', 'Diretor de Vendas', 'Gerente de Vendas'],
    geral: ['CEO', 'Sócio', 'Proprietário', 'Owner', 'Founder', 'Fundador', 'Diretor', 'Director', 'Presidente', 'President', 'Partner'],
  };

  if (level === 'donos') {
    return ['CEO', 'Sócio', 'Proprietário', 'Owner', 'Founder', 'Fundador', 'Sócio Proprietário', 'Partner'];
  }

  const titles = titlesByDept[department] || titlesByDept.logistica;
  if (level === 'gerencia') {
    return titles.filter((title) => /gerente|manager|head|coordenador|coordinator|supervisor/i.test(title));
  }
  if (level === 'decisores') {
    return titles.filter((title) => !/gerente|manager|coordenador|coordinator|supervisor/i.test(title));
  }
  return titles;
}

export async function GET(request: NextRequest) {
  const wantsHealthCheck = new URL(request.url).searchParams.get('health') === '1';
  if (!wantsHealthCheck) {
    return NextResponse.json({
      configured: Boolean(APOLLO_API_KEY),
      provider: 'apollo',
      message: APOLLO_API_KEY ? 'Apollo.io configurado' : 'APOLLO_API_KEY não configurada',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!APOLLO_API_KEY) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'APOLLO_API_KEY não configurada no ambiente de produção.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const headers = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    'X-Api-Key': APOLLO_API_KEY,
  };

  try {
    const healthResponse = await fetch(`${APOLLO_BASE_URL}/auth/health`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const health = await responseJson(healthResponse);
    const authenticated = healthResponse.ok && health.healthy === true && health.is_logged_in === true;

    if (!authenticated) {
      return NextResponse.json({
        ok: false,
        configured: true,
        authentication: {
          healthy: health.healthy === true,
          isLoggedIn: health.is_logged_in === true,
        },
        peopleSearch: { available: false, tested: false },
        message: 'A variável existe, mas o health check Apollo não confirmou autenticação.',
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    const healthSession = await getSession(request);
    if (!healthSession || healthSession.role !== 'master') {
      return NextResponse.json({
        ok: true,
        configured: true,
        authentication: { healthy: true, isLoggedIn: true },
        peopleSearch: { available: false, tested: false },
        message: healthSession
          ? 'Chave Apollo autenticada. O teste de busca de pessoas exige sessão master.'
          : 'Chave Apollo autenticada. O teste de busca de pessoas exige login.',
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    // Probe somente de People API Search: não revela emails/telefones e custa 0 créditos.
    const probeParams = new URLSearchParams();
    probeParams.set('page', '1');
    probeParams.set('per_page', '1');
    appendArrayParams(probeParams, 'person_locations', ['Brazil']);
    appendArrayParams(probeParams, 'person_titles', ['Logistics Manager']);

    const searchResponse = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search?${probeParams.toString()}`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const searchData = await responseJson(searchResponse);
    const searchAvailable = searchResponse.ok && Array.isArray(searchData.people);

    return NextResponse.json({
      ok: searchAvailable,
      configured: true,
      authentication: { healthy: true, isLoggedIn: true },
      peopleSearch: {
        available: searchAvailable,
        tested: true,
        httpStatus: searchResponse.status,
        returnedCount: Array.isArray(searchData.people) ? searchData.people.length : 0,
      },
      message: searchAvailable
        ? 'Chave autenticada e People API Search acessível.'
        : `Chave autenticada, mas People API Search respondeu HTTP ${searchResponse.status}.`,
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[prospect] Apollo health/probe failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({
      ok: false,
      configured: true,
      message: 'Falha de rede ao testar a conexão Apollo.',
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: NextRequest) {
  const searchOnly = request.nextUrl.searchParams.get('mode') === 'search_only';
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Login necessário para buscar ou enriquecer contatos Apollo.' }, { status: 401 });
  }
  if (session.role !== 'master') {
    return NextResponse.json({ ok: false, error: 'Apenas master pode pesquisar ou enriquecer contatos Apollo.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const country = normalizeCountry(body.country);
    const department = String(body.department || 'logistica').toLowerCase();
    const level = String(body.level || 'todos').toLowerCase();
    const parsedQty = Number.parseInt(String(body.qty || '10'), 10);
    const numResults = Math.min(Math.max(Number.isFinite(parsedQty) ? parsedQty : 10, 1), searchOnly ? 10 : 30);
    const workspaceAccess = await resolveWorkspace(request, body.workspaceSlug);
    if (!workspaceAccess.workspace) {
      return NextResponse.json({ ok: false, error: workspaceAccess.error }, { status: workspaceAccess.session ? 403 : 404 });
    }
    const workspaceSlug = workspaceAccess.workspace;
    const targetCompany = typeof body.company === 'string' ? body.company.trim() : '';
    const targetDomain = isDomain(targetCompany) ? normalizeDomain(targetCompany) : '';
    const requireEmail = searchOnly || body.requireEmail !== false;
    const parsedCreditCap = Number(body.maxCredits);
    const maxCredits = Number.isInteger(parsedCreditCap)
      ? Math.min(Math.max(parsedCreditCap, 0), numResults, 30)
      : 0;

    const industryInput = body.industry;
    const industryList = Array.isArray(industryInput)
      ? industryInput.map((value: unknown) => String(value))
      : typeof industryInput === 'string'
        ? industryInput.split(',')
        : [];
    const industryRaw = (industryList[0] || '').toLowerCase().trim();

    const allKeywords = new Set<string>();
    for (const rawItem of industryList) {
      const item = rawItem.trim().toLowerCase();
      if (!item) continue;
      if (INDUSTRY_MAP[item]) {
        INDUSTRY_MAP[item].forEach((keyword) => allKeywords.add(keyword));
      } else {
        allKeywords.add(item);
      }
    }
    const keywords = Array.from(allKeywords);
    const personTitles = getPersonTitles(department, level);

    if (!APOLLO_API_KEY) {
      return NextResponse.json(
        { ok: false, code: 'APOLLO_KEY_MISSING', error: 'APOLLO_API_KEY não configurada no servidor.' },
        { status: 503 },
      );
    }

    // O enrichment pode consumir créditos. O cliente precisa enviar um teto explícito após confirmação.
    if (maxCredits < 1 && !searchOnly) {
      return NextResponse.json({
        ok: false,
        code: 'APOLLO_CREDIT_LIMIT_REQUIRED',
        error: 'Confirme um limite de créditos para revelar emails profissionais.',
      }, { status: 400 });
    }

    let existingLeads: any[] = [];
    try {
      existingLeads = await getLeads(workspaceSlug);
    } catch (dbErr) {
      console.error('[prospect] Failed to load existing CRM leads:', dbErr instanceof Error ? dbErr.name : 'unknown');
    }

    const existingEmails = new Set(
      existingLeads.map((lead: any) => String(lead.email || '').toLowerCase().trim()).filter(Boolean),
    );
    const existingPersonCompanyPairs = new Set(
      existingLeads
        .map((lead: any) => `${normalizeCompanyName(lead.name || '')}|${normalizeCompanyName(lead.company || '')}`)
        .filter((key: string) => key !== '|'),
    );

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': APOLLO_API_KEY,
    };

    // People API Search documenta estes filtros como query parameters, não como JSON body.
    const searchParams = new URLSearchParams();
    searchParams.set('page', '1');
    searchParams.set('per_page', String(Math.min(Math.max(numResults * 3, 10), 100)));
    searchParams.set('include_similar_titles', 'true');
    appendArrayParams(searchParams, 'person_locations', [country]);
    appendArrayParams(searchParams, 'person_titles', personTitles);
    if (requireEmail) appendArrayParams(searchParams, 'contact_email_status', ['verified']);

    if (targetDomain) {
      appendArrayParams(searchParams, 'q_organization_domains_list', [targetDomain]);
    } else if (targetCompany) {
      searchParams.set('q_keywords', targetCompany);
    } else if (keywords.length > 0) {
      searchParams.set('q_keywords', keywords.slice(0, 10).join(' '));
    }

    const searchResponse = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search?${searchParams.toString()}`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });

    if (!searchResponse.ok) {
      console.error('[prospect] Apollo People Search HTTP error:', searchResponse.status);
      const code = searchResponse.status === 401
        ? 'APOLLO_AUTH_REJECTED'
        : searchResponse.status === 403
          ? 'APOLLO_SEARCH_ACCESS_DENIED'
          : 'APOLLO_SEARCH_FAILED';
      const error = searchResponse.status === 401
        ? 'Apollo rejeitou a autenticação da chave configurada.'
        : searchResponse.status === 403
          ? 'Apollo autenticou a requisição, mas recusou acesso ao People API Search para esta chave/conta.'
          : `People API Search falhou (HTTP ${searchResponse.status}).`;
      return NextResponse.json({ ok: false, code, error, upstreamStatus: searchResponse.status }, { status: 502 });
    }

    const searchResult = await responseJson(searchResponse);
    const people = Array.isArray(searchResult.people) ? searchResult.people : [];
    const candidates = people.filter((person: any) => {
      const organization = person.organization || {};
      const companyName = String(organization.name || '').trim();
      const name = String(person.name || `${person.first_name || ''} ${person.last_name || ''}`).trim();
      if (!person.id || !companyName || !name) return false;

      if (targetDomain) {
        const returnedDomain = normalizeDomain(organization.primary_domain || organization.website_url || '');
        if (returnedDomain && returnedDomain !== targetDomain && !returnedDomain.endsWith(`.${targetDomain}`)) return false;
      } else if (targetCompany) {
        const requested = normalizeCompanyName(targetCompany);
        const returned = normalizeCompanyName(companyName);
        if (!returned || (!returned.includes(requested) && !requested.includes(returned))) return false;
      }

      const pairKey = `${normalizeCompanyName(name)}|${normalizeCompanyName(companyName)}`;
      if (existingPersonCompanyPairs.has(pairKey)) return false;

      const status = String(person.email_status || person.contact_email_status || '').toLowerCase();
      if (requireEmail && status && status !== 'verified') return false;
      return true;
    });

    if (searchOnly) {
      const leads = candidates.slice(0, numResults).map((person: any) => {
        const organization = person.organization || {};
        const name = String(person.name || `${person.first_name || ''} ${person.last_name || ''}`).trim();
        const company = String(organization.name || '').trim();
        const city = String(person.city || organization.city || '');
        const state = String(person.state || organization.state || '');
        let website = String(organization.primary_domain || organization.website_url || '');
        if (website && !website.startsWith('http')) website = `https://${website}`;
        return {
          id: String(person.id),
          name,
          company,
          role: String(person.title || 'Decisor'),
          email: '',
          email_status: String(person.email_status || person.contact_email_status || 'unknown').toLowerCase(),
          phone: '',
          whatsapp: '',
          website,
          location: [city, state].filter(Boolean).join(' - ') || 'Brasil',
          city,
          state,
          industry: String(organization.industry || industryRaw || 'Outros'),
          linkedin: String(person.linkedin_url || ''),
          source: 'Apollo.io',
          isNewReveal: false,
          hasRealMobile: false,
        };
      });
      return NextResponse.json({
        ok: true,
        count: leads.length,
        total: leads.length,
        provider: 'apollo',
        searchOnly: true,
        creditsUsed: 0,
        leads,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, count: 0, total: 0, provider: 'apollo', leads: [], creditsUsed: 0 });
    }

    // O número de perfis enviados a enrichment nunca excede o teto confirmado pelo usuário.
    const peopleToReveal = candidates.slice(0, Math.min(numResults, maxCredits));
    const revealed: Array<{ candidate: any; match: any }> = [];
    let creditsUsed = 0;
    let enrichmentWarning = '';

    const enrichmentParams = new URLSearchParams();
    enrichmentParams.set('reveal_personal_emails', 'false');
    enrichmentParams.set('reveal_phone_number', 'false');
    enrichmentParams.set('run_waterfall_email', 'false');
    enrichmentParams.set('run_waterfall_phone', 'false');

    for (let offset = 0; offset < peopleToReveal.length; offset += 10) {
      const chunk = peopleToReveal.slice(offset, offset + 10);
      const matchResponse = await fetch(`${APOLLO_BASE_URL}/people/bulk_match?${enrichmentParams.toString()}`, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({ details: chunk.map((person: any) => ({ id: person.id })) }),
        signal: AbortSignal.timeout(20000),
      });

      if (!matchResponse.ok) {
        console.error('[prospect] Apollo bulk enrichment HTTP error:', matchResponse.status);
        enrichmentWarning = `Enrichment interrompido pelo Apollo (HTTP ${matchResponse.status}); resultados anteriores foram preservados.`;
        if (revealed.length === 0) {
          return NextResponse.json({
            ok: false,
            code: 'APOLLO_ENRICHMENT_FAILED',
            error: `Falha ao revelar emails profissionais (HTTP ${matchResponse.status}).`,
          }, { status: 502 });
        }
        break;
      }

      const matchResult = await responseJson(matchResponse);
      const matches = Array.isArray(matchResult.matches) ? matchResult.matches : [];
      const batchCredits = Number(matchResult.credits_consumed || 0);
      if (Number.isFinite(batchCredits)) creditsUsed += batchCredits;
      for (let index = 0; index < chunk.length; index += 1) {
        const match = matches[index];
        if (match && typeof match === 'object') revealed.push({ candidate: chunk[index], match });
      }
    }

    const leads = revealed
      .map(({ candidate, match }) => {
        const organization = match.organization || candidate.organization || {};
        const name = String(match.name || `${match.first_name || ''} ${match.last_name || ''}`.trim() || candidate.name || `${candidate.first_name || ''} ${candidate.last_name || ''}`).trim();
        const company = String(organization.name || candidate.organization?.name || 'Empresa não informada');
        const email = String(match.email || '').trim();
        const emailStatus = String(match.email_status || candidate.email_status || 'unknown').toLowerCase();
        let website = String(organization.primary_domain || organization.website_url || '');
        if (website && !website.startsWith('http')) website = `https://${website}`;

        const city = String(match.city || candidate.city || organization.city || '');
        const state = String(match.state || candidate.state || organization.state || '');
        const employees = Number(organization.estimated_num_employees || 0);
        let employeeRange = organization.num_employees_range || 'N/A';
        if (employees) {
          if (employees < 11) employeeRange = '1-10';
          else if (employees < 51) employeeRange = '11-50';
          else if (employees < 201) employeeRange = '51-200';
          else if (employees < 501) employeeRange = '201-500';
          else employeeRange = '500+';
        }

        return {
          id: String(match.id || candidate.id),
          name,
          company,
          role: String(match.title || candidate.title || 'Decisor'),
          email,
          email_status: emailStatus,
          phone: '',
          whatsapp: '',
          website,
          location: [city, state].filter(Boolean).join(' - ') || 'Brasil',
          city,
          state,
          industry: String(organization.industry || industryRaw || 'Outros'),
          employees: employeeRange,
          logo: String(organization.logo_url || candidate.organization?.logo_url || ''),
          description: String(organization.short_description || candidate.organization?.short_description || ''),
          linkedin: String(match.linkedin_url || candidate.linkedin_url || ''),
          source: 'Apollo.io',
          isNewReveal: true,
          hasRealMobile: false,
        };
      })
      .filter((lead: any) => {
        if (!lead.email) return false;
        if (requireEmail && lead.email_status !== 'verified') return false;
        if (existingEmails.has(lead.email.toLowerCase())) return false;
        return true;
      });

    return NextResponse.json({
      ok: true,
      count: leads.length,
      total: leads.length,
      provider: 'apollo',
      leads,
      creditsUsed,
      ...(enrichmentWarning ? { warning: enrichmentWarning } : {}),
    });
  } catch (error: any) {
    console.error('[prospect] Handler error:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json(
      { ok: false, error: 'Falha ao buscar ou enriquecer prospects no Apollo.' },
      { status: 500 },
    );
  }
}
