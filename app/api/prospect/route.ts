import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// URL do proxy Vibe Prospecting (Explorium) — servidor local com MCP
// Fallback para Apollo.io se o proxy não estiver disponível
const VIBE_PROXY_URL = process.env.VIBE_PROXY_URL || 'https://3001-iocu0mm3to8rhntcq5bg7-d5828773.us2.manus.computer';

export async function GET() {
  return NextResponse.json({ 
    configured: true, 
    provider: 'vibe-prospecting',
    proxy: VIBE_PROXY_URL 
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { country, department, level, industry, qty, keywords, entity_type } = body;

    // Mapear parâmetros para o proxy
    const proxyBody = {
      country: country || 'brasil',
      keywords: keywords || industry || department || 'software',
      company_size: '11-50',
      qty: Math.min(parseInt(qty) || 10, 50),
      entity_type: entity_type || 'businesses',
      department: department || '',
      level: level || '',
    };

    // Chamar o proxy Vibe Prospecting
    const proxyRes = await fetch(`${VIBE_PROXY_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody),
      signal: AbortSignal.timeout(120000), // 2 minutos
    });

    if (!proxyRes.ok) {
      const errText = await proxyRes.text();
      throw new Error(`Proxy error ${proxyRes.status}: ${errText.slice(0, 200)}`);
    }

    const data = await proxyRes.json();

    if (!data.ok) {
      throw new Error(data.error || 'Erro no Vibe Prospecting');
    }

    return NextResponse.json({
      ok: true,
      count: data.count,
      total: data.total,
      provider: 'vibe-prospecting',
      leads: data.leads,
    });

  } catch (e: any) {
    // Fallback: tentar Apollo.io se disponível
    const apolloKey = process.env.APOLLO_API_KEY;
    if (apolloKey) {
      try {
        const { country, department, qty } = await req.clone().json().catch(() => ({}));
        const apolloRes = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apolloKey,
          },
          body: JSON.stringify({
            page: 1,
            per_page: Math.min(parseInt(qty) || 10, 25),
            organization_locations: [country || 'Brazil'],
          }),
        });
        if (apolloRes.ok) {
          const apolloData = await apolloRes.json();
          const leads = (apolloData.organizations || []).map((org: any) => ({
            name: org.name,
            company: org.name,
            email: org.primary_domain ? `contato@${org.primary_domain}` : '',
            website: org.website_url || '',
            employees: org.estimated_num_employees || '',
            industry: org.industry || '',
            role: 'Empresa',
          }));
          return NextResponse.json({ ok: true, count: leads.length, provider: 'apollo', leads });
        }
      } catch {}
    }

    return NextResponse.json(
      { ok: false, error: e.message || 'Erro ao buscar leads' },
      { status: 500 }
    );
  }
}
