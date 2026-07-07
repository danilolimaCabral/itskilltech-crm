import { NextRequest, NextResponse } from 'next/server';
import { getLeads, upsertLead } from '@/lib/db';

export const dynamic = 'force-dynamic';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || 'SlEHY1vVqch_obbLuR1T_A';
const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';

// Mapeamento de segmentos amigáveis em português para palavras-chave em inglês do Apollo
const INDUSTRY_MAP: Record<string, string[]> = {
  'logistica': ['logistics and supply chain', 'supply chain', 'warehousing', 'transportation'],
  'transporte': ['transportation', 'trucking', 'freight', 'cargo'],
  'tecnologia': ['information technology and services', 'software development', 'computer software', 'saas'],
  'ti': ['information technology and services', 'computer & network security', 'computer software'],
  'software': ['computer software', 'software development', 'saas'],
  'varejo': ['retail', 'wholesale', 'supermarkets'],
  'saude': ['hospital & health care', 'medical devices', 'pharmaceuticals'],
  'educacao': ['e-learning', 'education management', 'higher education'],
  'marketing': ['marketing and advertising', 'public relations and communications'],
  'consultoria': ['management consulting', 'business supplies and equipment'],
  'industria': ['industrial automation', 'machinery', 'manufacturing', 'mechanical engineering'],
  'construcao': ['construction', 'civil engineering', 'building materials'],
  'alimentacao': ['food & beverages', 'food production', 'wholesale food', 'food distribution', 'food and beverage', 'packaged foods'],
  'atacado': ['wholesale', 'wholesale food', 'wholesale food & beverage', 'food distribution', 'beverage distribution', 'consumer goods distribution'],
  'distribuidor': ['wholesale', 'food distribution', 'beverage distribution', 'consumer goods distribution', 'logistics and supply chain'],
  'agro': ['farming', 'agriculture', 'food production'],
  'financeiro': ['financial services', 'banking', 'investment management'],
};

function formatPhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) return formatPhone(digits.slice(2));
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  return raw;
}

// Função rígida para validar se o número é de fato um celular brasileiro (WhatsApp válido)
function isMobilePhone(raw: string): boolean {
  if (!raw) return false;
  const digits = raw.replace(/\D/g, '');
  
  // Celular brasileiro com DDI: 55 + DDD (2 dígitos) + 9 dígitos começando com 9 -> total 13 dígitos
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits.charAt(4) === '9';
  }
  // Celular brasileiro com DDD (sem DDI): DDD (2 dígitos) + 9 dígitos começando com 9 -> total 11 dígitos
  if (digits.length === 11) {
    return digits.charAt(2) === '9';
  }
  // Apenas o número de celular de 9 dígitos (sem DDD, sem DDI)
  if (digits.length === 9) {
    return digits.startsWith('9');
  }
  
  return false;
}

// Normaliza o nome da empresa para comparação de duplicidades
function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\bs\.?a\.?\b/g, '') // remove S.A.
    .replace(/\bltda\b/g, '') // remove Ltda
    .replace(/[^a-z0-9]/g, '') // remove caracteres especiais
    .trim();
}

export async function GET() {
  return NextResponse.json({
    configured: !!APOLLO_API_KEY,
    provider: 'apollo',
    message: APOLLO_API_KEY ? 'Apollo.io configurado com sucesso' : 'APOLLO_API_KEY não configurada',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const country = body.country || 'Brazil';
    // Suportar múltiplos segmentos separados por vírgula ou array
    const industryInput = body.industry;
    const industryList = Array.isArray(industryInput) 
      ? industryInput 
      : (typeof industryInput === 'string' ? industryInput.split(',') : []);
    
    const industryRaw = (industryList[0] || '').toLowerCase().trim();
    const department = body.department || 'ti'; // ti, operacoes, logistica, comercial, geral
    const level = body.level || 'decisores'; // decisores, donos, gerencia, todos
    const numResults = Math.min(parseInt(body.qty || '10'), 30); // Limitar a busca em lote a no máximo 30 para economizar taxa de requisição paralela e créditos
    const workspaceSlug = body.workspaceSlug || 'lottus';
    
    // Filtros de qualidade exigidos pelo usuário
    const requireEmail = body.requireEmail !== false; // padrão true
    const requirePhone = body.requirePhone !== false; // padrão true

    // 1. Mapear palavras-chave do segmento (industry) de forma inteligente e expandida
    let keywords: string[] = [];
    
    if (industryList.length > 0) {
      const allMatches = new Set<string>();
      
      for (const rawItem of industryList) {
        const itemClean = rawItem.trim().toLowerCase();
        if (!itemClean) continue;
        
        if (INDUSTRY_MAP[itemClean]) {
          INDUSTRY_MAP[itemClean].forEach(k => allMatches.add(k));
        } else {
          // Mapeamento dinâmico de termos em português para inglês do Apollo
          const lowerRaw = itemClean;
          if (lowerRaw.includes('alimento') || lowerRaw.includes('bebida') || lowerRaw.includes('comida') || lowerRaw.includes('food') || lowerRaw.includes('beverage')) {
            ['food & beverages', 'food production', 'wholesale food', 'food distribution', 'packaged foods'].forEach(k => allMatches.add(k));
          }
          if (lowerRaw.includes('atacado') || lowerRaw.includes('atacadista') || lowerRaw.includes('wholesale')) {
            ['wholesale', 'wholesale food', 'wholesale food & beverage', 'food distribution', 'beverage distribution'].forEach(k => allMatches.add(k));
          }
          if (lowerRaw.includes('distribuidor') || lowerRaw.includes('distribuidora') || lowerRaw.includes('distribution')) {
            ['wholesale', 'food distribution', 'beverage distribution', 'consumer goods distribution', 'logistics and supply chain'].forEach(k => allMatches.add(k));
          }
          if (lowerRaw.includes('logistica') || lowerRaw.includes('logistics') || lowerRaw.includes('entrega')) {
            ['logistics and supply chain', 'supply chain', 'warehousing', 'transportation'].forEach(k => allMatches.add(k));
          }
          if (lowerRaw.includes('transporte') || lowerRaw.includes('transportadora') || lowerRaw.includes('transportation')) {
            ['transportation', 'trucking', 'freight', 'cargo'].forEach(k => allMatches.add(k));
          }
          
          if (allMatches.size === 0) {
            allMatches.add(itemClean);
          }
        }
      }
      
      keywords = Array.from(allMatches);
    } else {
      // Se não houver segmento especificado, mas o departamento for comercial/logística,
      // direcionamos por padrão para atacado/distribuição de alimentos e bens de consumo (alvos ideais do getLOG)
      if (department === 'comercial' || department === 'logistica' || department === 'operacoes') {
        keywords = ['wholesale food', 'food distribution', 'beverage distribution', 'wholesale', 'consumer goods distribution'];
      } else {
        keywords = ['logistics and supply chain', 'transportation', 'wholesale', 'food & beverages'];
      }
    }

    // 2. Mapear Cargos (person_titles) baseado no setor e nível selecionados
    let personTitles: string[] = [];
    
    const titlesByDept: Record<string, string[]> = {
      ti: ['Director of IT', 'Gerente de TI', 'Diretor de TI', 'CTO', 'Chief Technology Officer', 'IT Manager', 'Head of IT', 'Coordenador de TI'],
      logistica: ['Diretor de Logistica', 'Gerente de Logistica', 'Logistics Manager', 'Supply Chain Manager', 'Diretor de Suprimentos', 'Gerente de Supply Chain', 'Head of Logistics', 'Coordenador de Logística'],
      operacoes: ['COO', 'Chief Operating Officer', 'Diretor de Operações', 'Gerente de Operações', 'Operations Manager', 'Head of Operations', 'Diretor Operacional'],
      comercial: ['Diretor Comercial', 'Gerente Comercial', 'Sales Director', 'Sales Manager', 'Head of Sales', 'Diretor de Vendas', 'Gerente de Vendas', 'SDR Manager'],
      geral: ['CEO', 'Sócio', 'Proprietário', 'Owner', 'Founder', 'Fundador', 'Diretor', 'Director', 'Presidente', 'President', 'Partner', 'Sócio Proprietário'],
    };

    if (level === 'donos') {
      personTitles = ['CEO', 'Sócio', 'Proprietário', 'Owner', 'Founder', 'Fundador', 'Sócio Proprietário', 'Partner'];
    } else if (level === 'gerencia') {
      if (department === 'todos') {
        personTitles = ['Gerente', 'Manager', 'Head', 'Coordenador', 'Supervisor'];
      } else {
        personTitles = (titlesByDept[department] || titlesByDept['ti']).filter(t => t.toLowerCase().includes('gerente') || t.toLowerCase().includes('manager') || t.toLowerCase().includes('head') || t.toLowerCase().includes('coordenador'));
      }
    } else if (level === 'decisores') {
      if (department === 'todos') {
        personTitles = ['CEO', 'Sócio', 'Diretor', 'Director', 'CTO', 'COO', 'VP', 'Vice President', 'Founder', 'Fundador'];
      } else {
        personTitles = (titlesByDept[department] || titlesByDept['ti']).filter(t => !t.toLowerCase().includes('gerente') && !t.toLowerCase().includes('coordenador') && !t.toLowerCase().includes('supervisor'));
      }
    } else {
      personTitles = department === 'todos' 
        ? ['CEO', 'Sócio', 'Diretor', 'Director', 'Gerente', 'Manager', 'Founder', 'Fundador'] 
        : (titlesByDept[department] || titlesByDept['ti']);
    }

    if (!APOLLO_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'APOLLO_API_KEY não configurada no servidor' },
        { status: 503 }
      );
    }

    // --- CARREGAR LEADS EXISTENTES PARA EVITAR DUPLICIDADE ---
    let existingLeads: any[] = [];
    try {
      existingLeads = await getLeads(workspaceSlug);
    } catch (dbErr) {
      console.error('[prospect] Erro ao carregar leads existentes do banco:', dbErr);
    }

    const existingEmails = new Set(existingLeads.map((l: any) => (l.email || '').toLowerCase().trim()).filter(Boolean));
    const existingCompaniesNormalized = new Set(existingLeads.map((l: any) => normalizeCompanyName(l.company)).filter(Boolean));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': APOLLO_API_KEY,
    };

    // 1. Fazer a busca de pessoas ofuscadas (solicitamos o triplo do limite para garantir que filtremos as duplicidades locais e ainda tenhamos leads suficientes)
    const searchPayload: Record<string, any> = {
      page: 1,
      per_page: Math.min(numResults * 3, 100),
      person_locations: [country],
      person_titles: personTitles.length > 0 ? personTitles : undefined,
    };

    // Filtro nativo do Apollo para garantir que os contatos tenham telefones
    if (requirePhone) {
      searchPayload.contact_phone_book_statuses = ["verified", "unverified"];
    }

    if (keywords.length > 0) {
      searchPayload.q_organization_keyword_tags = keywords;
    }

    const searchResp = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (!searchResp.ok) {
      const errText = await searchResp.text();
      console.error('[prospect] Apollo search error:', searchResp.status, errText.slice(0, 200));
      return NextResponse.json(
        { ok: false, error: `Erro na busca do Apollo: ${searchResp.status}` },
        { status: searchResp.status }
      );
    }

    const searchResult = await searchResp.json();
    const obfuscatedPeople = searchResult.people || [];

    // Filtrar localmente antes do match para economizar créditos do usuário com empresas ou e-mails que já existem no CRM!
    const filteredObfuscatedPeople = obfuscatedPeople.filter((person: any) => {
      const org = person.organization || {};
      const companyName = org.name || '';
      
      // Se a empresa já existe no CRM, descarta imediatamente
      if (companyName && existingCompaniesNormalized.has(normalizeCompanyName(companyName))) {
        return false;
      }
      return true;
    });

    if (filteredObfuscatedPeople.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        total: 0,
        provider: 'apollo',
        leads: [],
        creditsUsed: 0,
      });
    }

    // Limitar o Promise.all para o número solicitado pelo usuário para não estourar rate limits e poupar chamadas paralelas
    const peopleToReveal = filteredObfuscatedPeople.slice(0, numResults);

    // 2. Revelar (Match) os dados em paralelo usando Promise.all
    let creditsUsed = 0;
    const revealPromises = peopleToReveal.map(async (person: any) => {
      try {
        const matchResp = await fetch(`${APOLLO_BASE_URL}/people/match`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: person.id,
            reveal_personal_emails: true,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (matchResp.ok) {
          const matchResult = await matchResp.json();
          const revealedPerson = matchResult.person || null;
          
          if (revealedPerson && !revealedPerson.revealed_for_current_team) {
            creditsUsed += 1;
          }
          
          return revealedPerson;
        }
        return null;
      } catch (err) {
        console.error(`[prospect] Error revealing person ${person.id}:`, err);
        return null;
      }
    });

    const revealedPeople = (await Promise.all(revealPromises)).filter(Boolean);

    if (creditsUsed === 0 && revealedPeople.length > 0) {
      creditsUsed = revealedPeople.filter((p: any) => !p.revealed_for_current_team).length;
    }

    // 3. Filtrar e Normalizar os resultados conforme exigências de e-mail e celular
    const leads = revealedPeople
      .map((person: any) => {
        const org = person.organization || {};
        let domain = org.primary_domain || org.website_url || '';
        if (domain && !domain.startsWith('http')) domain = `https://${domain}`;

        // Capturar telefones (prioridade absoluta para Celular/WhatsApp de fato)
        const phoneNumbers = person.phone_numbers || [];
        
        // Filtrar e separar celulares reais de telefones fixos
        const mobilePhones = phoneNumbers
          .filter((p: any) => 
            (p.type || '').toLowerCase().includes('mobile') || 
            (p.type || '').toLowerCase().includes('cell')
          )
          .map((p: any) => p.sanitized_number || p.raw_number)
          .filter(Boolean);

        const directPhones = phoneNumbers
          .filter((p: any) => 
            (p.type || '').toLowerCase().includes('direct')
          )
          .map((p: any) => p.sanitized_number || p.raw_number)
          .filter(Boolean);

        const corporatePhones = phoneNumbers
          .filter((p: any) => 
            (p.type || '').toLowerCase().includes('corporate') || 
            (p.type || '').toLowerCase().includes('work')
          )
          .map((p: any) => p.sanitized_number || p.raw_number)
          .filter(Boolean);

        // Encontrar se existe algum celular de fato em qualquer uma das categorias
        const allPhones = [...mobilePhones, ...directPhones, ...corporatePhones, person.phone_number, org.primary_phone?.number, org.sanitized_phone].filter(Boolean);
        const actualMobile = allPhones.find(isMobilePhone) || '';
        const fallbackPhone = mobilePhones[0] || directPhones[0] || corporatePhones[0] || person.phone_number || org.primary_phone?.number || org.sanitized_phone || '';

        // Se exigir telefone, tentamos pegar o celular. Se não tiver celular de fato, mas requirePhone estiver ativo,
        // nós vamos guardar se ele é celular ou fixo para filtrar rigidamente depois.
        const finalRawPhone = actualMobile || fallbackPhone;
        const formatted = formatPhone(finalRawPhone);
        const hasRealMobile = !!actualMobile;

        const city = person.city || org.city || '';
        const state = person.state || org.state || '';
        const location = [city, state].filter(Boolean).join(' - ') || 'Brasil';

        const employees = org.estimated_num_employees || 0;
        let empRange = org.num_employees_range || 'N/A';
        if (employees) {
          if (employees < 11) empRange = '1-10';
          else if (employees < 51) empRange = '11-50';
          else if (employees < 201) empRange = '51-200';
          else if (employees < 501) empRange = '201-500';
          else empRange = '500+';
        }

        return {
          id: person.id || `ap_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Decisor',
          company: org.name || 'Empresa não informada',
          role: person.title || 'Decisor',
          email: person.email || '',
          email_status: person.email_status || 'unknown',
          phone: formatted,
          whatsapp: finalRawPhone.replace(/\D/g, ''), // limpo para disparo de whatsapp
          website: domain,
          location,
          city,
          state,
          industry: org.industry || industryRaw || 'Outros',
          employees: empRange,
          logo: org.logo_url || '',
          description: org.short_description || '',
          linkedin: person.linkedin_url || '',
          source: 'Apollo.io',
          isNewReveal: !person.revealed_for_current_team, // Indica se gastou crédito agora
          hasRealMobile, // Flag interna para filtro rígido
        };
      })
      // Filtrar conforme exigência do usuário E evitar duplicidade por e-mail caso o e-mail revelado já exista no CRM
      .filter((lead: any) => {
        if (requireEmail && !lead.email) return false;
        
        // Se exigir telefone, agora exigimos RIGIDAMENTE celular móvel de fato para WhatsApp!
        if (requirePhone && (!lead.phone || !lead.hasRealMobile)) return false;
        
        // Se o e-mail revelado já existe no CRM, descarta para evitar duplicidade de contato
        if (lead.email && existingEmails.has(lead.email.toLowerCase().trim())) {
          return false;
        }
        
        return true;
      });

    // Limitar para a quantidade exata pedida pelo usuário
    const limitedLeads = leads.slice(0, numResults);

    // Ajustar creditsUsed proporcionalmente para os leads exibidos
    const finalCreditsUsed = limitedLeads.filter((l: any) => l.isNewReveal).length;

    return NextResponse.json({
      ok: true,
      count: limitedLeads.length,
      total: leads.length,
      provider: 'apollo',
      leads: limitedLeads,
      creditsUsed: finalCreditsUsed,
    });

  } catch (error: any) {
    console.error('[prospect] Handler error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Erro ao buscar leads no Apollo' },
      { status: 500 }
    );
  }
}
