import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/prospect
// body: { country, department, level, industry, qty }
// Usa a API do Apollo para buscar pessoas (prospects) reais.
// A chave fica no servidor: process.env.APOLLO_API_KEY

const LEVEL_MAP: Record<string, string[]> = {
  decisores: ['c_suite', 'director', 'vp'],
  donos: ['owner', 'founder'],
  gerencia: ['manager', 'senior'],
};

const DEPT_KEYWORDS: Record<string, string> = {
  ti: 'information technology',
  operacoes: 'operations',
  logistica: 'logistics',
  comercial: 'sales',
};

export async function GET() {
  // Status: informa se a API está configurada
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

    const body: any = {
      page: 1,
      per_page: Math.min(parseInt(qty) || 25, 100),
      person_titles: [],
      person_seniorities: LEVEL_MAP[level] || [],
    };
    if (country) body.person_locations = [country];
    const deptKw = DEPT_KEYWORDS[department];
    if (deptKw) body.q_keywords = deptKw;
    if (industry) body.q_keywords = (body.q_keywords ? body.q_keywords + ' ' : '') + industry;

    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ ok: false, error: `Apollo: ${res.status} ${txt.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const people = (data.people || []).map((p: any) => ({
      name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' '),
      email: p.email || '',
      company: p.organization?.name || '',
      role: p.title || '',
      linkedin: p.linkedin_url || '',
      phone: p.phone_numbers?.[0]?.sanitized_number || '',
    }));

    return NextResponse.json({ ok: true, count: people.length, leads: people });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
