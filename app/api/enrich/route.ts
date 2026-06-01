import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// Mapeamento de empresas conhecidas da planilha para seus CNPJs
const KNOWN_CNPJS: Record<string, string> = {
  'roldão atacadista': '07170938000100',
  'roldao atacadista': '07170938000100',
  'portobello': '83475913000150',
  'portobello grupo': '83475913000150',
  'makro': '59291534000167',
  'makro atacadista': '59291534000167',
  'duratex': '97837181000147',
  'dexco': '97837181000147',
  'eucatex': '60900846000128',
  'saint gobain': '61064929000190',
  'saint-gobain': '61064929000190',
  'cassol': '87230938000100',
  'cassol centerlar': '87230938000100',
  'leroy merlin': '04867554000100',
  'c&a': '45242914000131',
  'renner': '92754738000162',
  'riachuelo': '33200056000196',
  'marisa': '43470942000196',
  'hering': '78876950000171',
  'totvs': '53113791000122',
  'linx': '06948969000175',
  'senior sistemas': '00569178000192',
  'sankhya': '00543283000110',
  'sap brasil': '01877862000100',
  'oracle brasil': '59456277000176',
  'microsoft brasil': '60316817000100',
  'ibm brasil': '33372251000100',
  'accenture brasil': '04418407000100',
  'deloitte brasil': '49288247000148',
  'pwc brasil': '61562112000120',
};

async function searchCNPJByName(companyName: string): Promise<string | null> {
  // Primeiro tenta o mapeamento local
  const normalized = companyName.toLowerCase().trim();
  for (const [key, cnpj] of Object.entries(KNOWN_CNPJS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return cnpj;
    }
  }

  // Tenta busca via ReceitaWS (busca por nome)
  try {
    const encoded = encodeURIComponent(companyName);
    const res = await fetch(
      `https://receitaws.com.br/v1/cnpj/search?q=${encoded}&limit=1`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.cnpj) return data.cnpj.replace(/\D/g, '');
    }
  } catch {}

  return null;
}

async function enrichByCNPJ(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '');

  // Tenta BrasilAPI primeiro
  try {
    const res = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const d = await res.json();
      return {
        cnpj: clean,
        razao_social: d.razao_social || d.nome || '',
        telefone: formatPhone(d.ddd_telefone_1 || d.telefone || ''),
        telefone2: formatPhone(d.ddd_telefone_2 || ''),
        email: d.email || '',
        municipio: d.municipio || d.municipio_nome || '',
        uf: d.uf || '',
        cep: d.cep || '',
        logradouro: d.logradouro || '',
        source: 'BrasilAPI',
      };
    }
  } catch {}

  // Fallback: Minha Receita
  try {
    const res = await fetch(
      `https://minhareceita.org/${clean}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const d = await res.json();
      return {
        cnpj: clean,
        razao_social: d.razao_social || d.nome || '',
        telefone: formatPhone(d.telefone || ''),
        telefone2: '',
        email: d.email || '',
        municipio: d.municipio || '',
        uf: d.uf || '',
        cep: d.cep || '',
        logradouro: d.logradouro || '',
        source: 'MinhaReceita',
      };
    }
  } catch {}

  return null;
}

function formatPhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

// POST /api/enrich  { company: "Roldão Atacadista", cnpj?: "07170938000100" }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, cnpj: providedCnpj } = body;

    if (!company && !providedCnpj) {
      return NextResponse.json({ ok: false, error: 'Informe company ou cnpj' }, { status: 400 });
    }

    let cnpj = providedCnpj || null;

    // Se não tem CNPJ, tenta descobrir pelo nome
    if (!cnpj && company) {
      cnpj = await searchCNPJByName(company);
    }

    if (!cnpj) {
      return NextResponse.json({
        ok: false,
        error: `CNPJ não encontrado para "${company}". Informe o CNPJ manualmente.`,
      });
    }

    const data = await enrichByCNPJ(cnpj);

    if (!data) {
      return NextResponse.json({
        ok: false,
        error: `Dados não encontrados para o CNPJ ${cnpj}.`,
      });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
