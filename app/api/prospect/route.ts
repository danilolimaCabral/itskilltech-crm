import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/prospect
// body: { country, department, level, industry, qty }
// Usa a API do Apollo para buscar organizações (plano gratuito) e gera contatos realistas.

const INDUSTRY_MAP: Record<string, string[]> = {
  ti: ['Information Technology and Services', 'Computer Software', 'Internet'],
  operacoes: ['Logistics and Supply Chain', 'Transportation/Trucking/Railroad', 'Warehousing'],
  logistica: ['Logistics and Supply Chain', 'Transportation/Trucking/Railroad'],
  comercial: ['Retail', 'Wholesale', 'Consumer Goods'],
};

const DEPT_TITLES: Record<string, Record<string, string[]>> = {
  decisores: {
    ti: ['CTO', 'CIO', 'VP of Technology', 'Director of IT', 'Head of Technology'],
    operacoes: ['COO', 'VP of Operations', 'Director of Operations', 'Head of Operations'],
    logistica: ['VP of Logistics', 'Director of Supply Chain', 'Head of Logistics'],
    comercial: ['CCO', 'VP of Sales', 'Director of Sales', 'Head of Commercial'],
  },
  donos: {
    ti: ['CEO', 'Founder', 'Co-Founder', 'Owner'],
    operacoes: ['CEO', 'Founder', 'Co-Founder', 'Owner'],
    logistica: ['CEO', 'Founder', 'Co-Founder', 'Owner'],
    comercial: ['CEO', 'Founder', 'Co-Founder', 'Owner'],
  },
  gerencia: {
    ti: ['IT Manager', 'Technology Manager', 'Systems Manager', 'Infrastructure Manager'],
    operacoes: ['Operations Manager', 'Process Manager', 'Business Operations Manager'],
    logistica: ['Logistics Manager', 'Supply Chain Manager', 'Distribution Manager'],
    comercial: ['Sales Manager', 'Commercial Manager', 'Account Manager'],
  },
};

const COUNTRY_MAP: Record<string, string> = {
  brasil: 'Brazil',
  'estados unidos': 'United States',
  portugal: 'Portugal',
};

export async function GET() {
  return NextResponse.json({ configured: !!process.env.APOLLO_API_KEY });
}

export async function POST(req: Request) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, configured: false, error: 'APOLLO_API_KEY não configurada no servidor.' },
      { status: 400 }
    );
  }

  try {
    const { country, department, level, industry, qty } = await req.json();
    const perPage = Math.min(parseInt(qty) || 25, 100);

    // Mapear parâmetros
    const countryEn = COUNTRY_MAP[country?.toLowerCase()] || country || 'Brazil';
    const deptKey = department?.toLowerCase().replace(/\s+/g, '') === 'ti/tecnologia' ? 'ti'
      : department?.toLowerCase().includes('opera') ? 'operacoes'
      : department?.toLowerCase().includes('logis') ? 'logistica'
      : department?.toLowerCase().includes('comer') ? 'comercial'
      : 'ti';
    const levelKey = level?.toLowerCase().includes('decis') ? 'decisores'
      : level?.toLowerCase().includes('dono') || level?.toLowerCase().includes('fund') ? 'donos'
      : 'gerencia';

    const industries = INDUSTRY_MAP[deptKey] || INDUSTRY_MAP['ti'];
    const industryFilter = industry ? [industry, ...industries] : industries;

    // Buscar organizações via Apollo (endpoint gratuito)
    const orgBody: any = {
      page: 1,
      per_page: Math.min(perPage, 25),
      organization_locations: [countryEn],
      organization_industry_tag_ids: [],
      q_organization_keyword_tags: industryFilter.slice(0, 3),
      sort_by_field: 'organization_headcount',
      sort_ascending: false,
    };

    const orgRes = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(orgBody),
    });

    let leads: any[] = [];

    if (orgRes.ok) {
      const orgData = await orgRes.json();
      const companies = orgData.organizations || orgData.accounts || [];

      const titles = DEPT_TITLES[levelKey]?.[deptKey] || ['Manager', 'Director'];

      leads = companies.slice(0, perPage).map((org: any, idx: number) => {
        const title = titles[idx % titles.length];
        const domain = org.primary_domain || org.website_url?.replace(/https?:\/\//, '').split('/')[0] || '';
        const firstName = org.name?.split(' ')[0] || 'Contato';
        const lastName = org.name?.split(' ')[1] || String(idx + 1);

        return {
          name: `${title} - ${org.name}`,
          email: domain ? `contato@${domain}` : '',
          company: org.name || '',
          role: title,
          linkedin: org.linkedin_url || '',
          phone: org.phone || '',
          website: org.website_url || '',
          employees: org.estimated_num_employees || '',
          industry: org.industry || '',
        };
      });
    } else {
      // Fallback: buscar pessoas via endpoint alternativo
      const peopleBody: any = {
        page: 1,
        per_page: perPage,
        q_keywords: industryFilter[0],
        person_locations: [countryEn],
      };

      const peopleRes = await fetch('https://api.apollo.io/v1/people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify(peopleBody),
      });

      if (peopleRes.ok) {
        const peopleData = await peopleRes.json();
        leads = (peopleData.people || []).map((p: any) => ({
          name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' '),
          email: p.email || '',
          company: p.organization?.name || '',
          role: p.title || '',
          linkedin: p.linkedin_url || '',
          phone: p.phone_numbers?.[0]?.sanitized_number || '',
        }));
      } else {
        const errTxt = await peopleRes.text();
        return NextResponse.json({ ok: false, error: `Apollo: ${peopleRes.status} ${errTxt.slice(0, 300)}` }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, count: leads.length, leads });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
