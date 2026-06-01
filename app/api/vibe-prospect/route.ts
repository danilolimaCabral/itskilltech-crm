import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mapeamento de segmentos para categorias LinkedIn do Vibe Prospecting
const SEGMENT_MAP: Record<string, string[]> = {
  logistica:   ['transportation, logistics, supply chain and storage', 'warehousing and storage'],
  transporte:  ['transportation/trucking/railroad', 'truck transportation', 'freight and package transportation'],
  tms:         ['transportation, logistics, supply chain and storage', 'transportation/trucking/railroad'],
  tecnologia:  ['information technology and services', 'software development', 'computer software'],
  software:    ['computer software', 'software development', 'information technology and services'],
  atacado:     ['wholesale', 'wholesale import and export'],
  industria:   ['industrial automation', 'machinery', 'mechanical or industrial engineering'],
  saude:       ['hospital & health care', 'medical devices', 'health, wellness and fitness'],
  varejo:      ['retail', 'consumer goods'],
  construcao:  ['construction', 'civil engineering'],
  agro:        ['farming', 'food & beverages', 'food production'],
  financeiro:  ['financial services', 'banking', 'investment management'],
  educacao:    ['e-learning', 'education management', 'higher education'],
  alimentos:   ['food & beverages', 'food production', 'restaurants'],
};

const SIZE_MAP: Record<string, string> = {
  pequena:  '11-50',
  media:    '51-200',
  grande:   '201-500',
  all:      '11-200',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      industry = 'logistica',
      limit = 10,
      companySize = 'all',
      state,        // ex: "SP", "PR" — não suportado diretamente, usado como filtro pós-busca
    } = body;

    const categories = SEGMENT_MAP[industry.toLowerCase()] || SEGMENT_MAP['logistica'];
    const primaryCategory = categories[0];
    const sizeRange = SIZE_MAP[companySize] || SIZE_MAP['all'];

    // Passo 1: Autocomplete para obter o valor padronizado da categoria
    const autocompleteInput = JSON.stringify({
      field: 'linkedin_category',
      query: primaryCategory.split(',')[0].trim(),
      tool_reasoning: `buscar empresas de ${industry} no Brasil para prospecção B2B`,
    });

    let standardizedCategory = primaryCategory;
    try {
      const { stdout: autoOut } = await execAsync(
        `manus-mcp-cli tool call autocomplete --server vibe-prospecting --input '${autocompleteInput.replace(/'/g, '"')}'`,
        { timeout: 15000 }
      );
      const autoMatch = autoOut.match(/"value"\s*:\s*"([^"]+)"/);
      if (autoMatch) standardizedCategory = autoMatch[1];
    } catch {
      // usar categoria original se autocomplete falhar
    }

    // Passo 2: Buscar empresas com fetch-entities
    const fetchInput = JSON.stringify({
      tool_reasoning: `buscar empresas de ${industry} no Brasil para prospecção B2B de TMS/logística`,
      entity_type: 'businesses',
      filters: {
        linkedin_category: { values: [standardizedCategory] },
        company_country_code: { values: ['BR'] },
        company_size: { values: [sizeRange] },
        has_website: true,
      },
      number_of_results: Math.min(limit, 50),
    });

    const { stdout: fetchOut } = await execAsync(
      `manus-mcp-cli tool call fetch-entities --server vibe-prospecting --input '${fetchInput.replace(/'/g, '"')}'`,
      { timeout: 30000 }
    );

    // Extrair JSON do resultado
    let businesses: any[] = [];
    const jsonMatch = fetchOut.match(/\{[\s\S]*"preview_data"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(fetchOut.substring(fetchOut.indexOf('{')));
        businesses = parsed?.preview?.preview_data || [];
      } catch {
        // tentar extrair preview_data diretamente
        const dataMatch = fetchOut.match(/"preview_data"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
        if (dataMatch) {
          try { businesses = JSON.parse(dataMatch[1]); } catch { /* ignore */ }
        }
      }
    }

    // Mapear para o formato de lead do CRM
    const uid = () => 'vibe_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const leads = businesses
      .filter((b: any) => b.business_name && b.business_domain)
      .map((b: any) => ({
        id: uid(),
        name: b.business_name,
        company: b.business_name,
        role: 'Empresa',
        email: `contato@${b.business_domain}`,
        phone: '',
        whatsapp: '',
        linkedin: '',
        source: 'Vibe Prospecting',
        website: b.business_website || b.business_domain,
        city: b.business_city_name || '',
        state: b.business_region || '',
        size: b.business_number_of_employees_range || '',
        revenue: b.business_yearly_revenue_range || '',
        description: b.business_business_description || '',
        logo: b.business_logo || '',
        vibeId: b.business_id || '',
      }));

    return NextResponse.json({
      ok: true,
      leads,
      total: leads.length,
      source: 'vibe-prospecting',
      category: standardizedCategory,
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
