import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY || '';
const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';

const INDUSTRY_MAP: Record<string, string> = {
  'tecnologia': 'information technology and services',
  'ti': 'information technology and services',
  'software': 'computer software',
  'saas': 'computer software',
  'financeiro': 'financial services',
  'saude': 'hospital & health care',
  'educacao': 'e-learning',
  'varejo': 'retail',
  'logistica': 'logistics and supply chain',
  'marketing': 'marketing and advertising',
  'rh': 'staffing and recruiting',
  'consultoria': 'management consulting',
  'industria': 'industrial automation',
  'construcao': 'construction',
  'alimentacao': 'food & beverages',
};

export async function GET() {
  return NextResponse.json({
    configured: !!APOLLO_API_KEY,
    provider: 'apollo',
    message: APOLLO_API_KEY ? 'Apollo.io configurado' : 'APOLLO_API_KEY não configurada',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const country = body.country || 'Brazil';
    const industryRaw = (body.industry || body.department || body.keywords || '').toLowerCase();
    const numResults = Math.min(parseInt(body.qty || body.num_results || '25'), 100);
    const employeeRanges = body.employee_ranges || ['1,10', '11,50', '51,200'];

    const industry = INDUSTRY_MAP[industryRaw] || industryRaw || 'information technology and services';

    if (!APOLLO_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'APOLLO_API_KEY não configurada' },
        { status: 503 }
      );
    }

    const perPage = 25;
    const pagesNeeded = Math.ceil(numResults / perPage);
    const allOrgs: any[] = [];

    for (let page = 1; page <= pagesNeeded; page++) {
      const payload = {
        page,
        per_page: perPage,
        organization_locations: [country],
        organization_num_employees_ranges: employeeRanges,
        q_organization_keyword_tags: industry ? [industry] : [],
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
      };

      // Tentar endpoint principal
      let resp = await fetch(`${APOLLO_BASE_URL}/mixed_companies/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      // Fallback para endpoint alternativo
      if (!resp.ok) {
        resp = await fetch(`${APOLLO_BASE_URL}/organizations/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      if (resp.ok) {
        const result = await resp.json();
        const orgs = result.organizations || result.accounts || [];
        allOrgs.push(...orgs);

        const total = result.pagination?.total_entries || 0;
        if (allOrgs.length >= total || allOrgs.length >= numResults) break;
      } else {
        const errText = await resp.text();
        console.error('Apollo error:', resp.status, errText.slice(0, 200));
        break;
      }
    }

    const limited = allOrgs.slice(0, numResults);

    const leads = limited
      .filter((org: any) => org.name)
      .map((org: any) => {
        let domain = org.primary_domain || org.website_url || '';
        if (domain && !domain.startsWith('http')) domain = `https://${domain}`;

        const city = org.city || '';
        const countryName = org.country || '';
        const location = [city, countryName].filter(Boolean).join(', ');

        const employees = org.estimated_num_employees || 0;
        let empRange = org.num_employees_range || 'N/A';
        if (employees) {
          if (employees < 11) empRange = '1-10';
          else if (employees < 51) empRange = '11-50';
          else if (employees < 201) empRange = '51-200';
          else if (employees < 501) empRange = '201-500';
          else empRange = '500+';
        }

        const revenue = org.annual_revenue_printed || org.annual_revenue || '';

        return {
          id: org.id || '',
          name: org.name,
          company: org.name,
          email: org.primary_domain ? `contato@${org.primary_domain}` : '',
          phone: org.phone || '',
          website: domain,
          location,
          city,
          country: countryName,
          industry: org.industry || industry,
          employees: empRange,
          revenue: revenue ? String(revenue) : '',
          logo: org.logo_url || '',
          description: org.short_description || '',
          linkedin: org.linkedin_url || '',
          role: 'Empresa',
          source: 'Apollo.io',
        };
      });

    return NextResponse.json({
      ok: true,
      count: leads.length,
      total: leads.length,
      provider: 'apollo',
      leads,
    });

  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Erro ao buscar leads' },
      { status: 500 }
    );
  }
}
