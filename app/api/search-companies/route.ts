import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const CNPJA_KEY = process.env.CNPJA_API_KEY || ''
const BASE_URL = 'https://api.cnpja.com'

const openai = new OpenAI()

// Mapeamento de segmentos comuns para códigos CNAE
const CNAE_MAP: Record<string, string[]> = {
  transporte: ['4930201', '4930202', '4930203', '4921301', '4921302', '4922101', '4922102', '4922103'],
  logística: ['5211701', '5211702', '5212500', '5229001', '5229002', '5229099', '4930201'],
  logistica: ['5211701', '5211702', '5212500', '5229001', '5229002', '5229099', '4930201'],
  tecnologia: ['6201501', '6201502', '6202300', '6203100', '6204000', '6209100', '6311900'],
  software: ['6201501', '6201502', '6202300', '6209100'],
  ti: ['6201501', '6201502', '6202300', '6203100', '6204000', '6209100'],
  saúde: ['8610101', '8610102', '8621601', '8621602', '8630501', '8630502', '8630503'],
  saude: ['8610101', '8610102', '8621601', '8621602', '8630501', '8630502', '8630503'],
  varejo: ['4711301', '4711302', '4712100', '4713001', '4713002', '4721102', '4721103'],
  atacado: ['4632001', '4632002', '4632003', '4633801', '4634601', '4635401'],
  construção: ['4110700', '4120400', '4211101', '4211102', '4212000', '4213800'],
  construcao: ['4110700', '4120400', '4211101', '4211102', '4212000', '4213800'],
  agro: ['0111301', '0111302', '0111303', '0113000', '0115600', '0116401'],
  agronegócio: ['0111301', '0111302', '0111303', '0113000', '0115600', '0116401'],
  agronegocio: ['0111301', '0111302', '0111303', '0113000', '0115600', '0116401'],
  indústria: ['2211100', '2221800', '2229301', '2311700', '2312500', '2319200'],
  industria: ['2211100', '2221800', '2229301', '2311700', '2312500', '2319200'],
  educação: ['8511200', '8512100', '8513900', '8520100', '8531700', '8532500'],
  educacao: ['8511200', '8512100', '8513900', '8520100', '8531700', '8532500'],
  financeiro: ['6422100', '6423100', '6424701', '6424702', '6431000', '6432800'],
  financeira: ['6422100', '6423100', '6424701', '6424702', '6431000', '6432800'],
  alimentício: ['1011201', '1011202', '1012101', '1012102', '1013901', '1031700'],
  alimenticio: ['1011201', '1011202', '1012101', '1012102', '1013901', '1031700'],
  alimentos: ['1011201', '1011202', '1012101', '1012102', '1013901', '1031700'],
  telecomunicações: ['6110801', '6110802', '6110803', '6120501', '6120502', '6130200'],
  telecomunicacoes: ['6110801', '6110802', '6110803', '6120501', '6120502', '6130200'],
  energia: ['3511501', '3511502', '3512300', '3513100', '3514000', '3520401'],
  petróleo: ['0600001', '0600002', '1921700', '1922501', '1922502', '1922599'],
  petroleo: ['0600001', '0600002', '1921700', '1922501', '1922502', '1922599'],
  farmacêutico: ['2121101', '2121102', '2121103', '2122000', '4771701', '4771702'],
  farmaceutico: ['2121101', '2121102', '2121103', '2122000', '4771701', '4771702'],
  seguros: ['6511101', '6511102', '6512000', '6520100', '6530800', '6541300'],
  imobiliário: ['4110700', '6810201', '6810202', '6821801', '6821802', '6822600'],
  imobiliario: ['4110700', '6810201', '6810202', '6821801', '6821802', '6822600'],
  tms: ['4930201', '4930202', '5229001', '5229002', '6201501'],
  erp: ['6201501', '6201502', '6202300', '6209100'],
  consultoria: ['7020400', '7111100', '7112000', '7119701', '7119702', '7119799'],
  marketing: ['7311400', '7312200', '7319001', '7319002', '7319003', '7319004'],
  publicidade: ['7311400', '7312200', '7319001', '7319002', '7319003', '7319004'],
  turismo: ['7911200', '7912100', '7990200', '5510801', '5510802', '5590601'],
  hotelaria: ['5510801', '5510802', '5590601', '5590602', '5590603', '5590699'],
  restaurante: ['5611201', '5611202', '5611203', '5612100', '5620101', '5620102'],
  alimentação: ['5611201', '5611202', '5611203', '5612100', '5620101', '5620102'],
  alimentacao: ['5611201', '5611202', '5611203', '5612100', '5620101', '5620102'],
}

function formatPhone(phones: Array<{ area: string; number: string }> = []): string {
  if (!phones.length) return ''
  const p = phones[0]
  return `(${p.area}) ${p.number.slice(0, p.number.length - 4)}-${p.number.slice(-4)}`
}

function formatEmail(emails: Array<{ address: string }> = []): string {
  return emails[0]?.address || ''
}

function mapRecordToLead(o: {
  taxId?: string;
  alias?: string;
  founded?: string;
  head?: boolean;
  status?: { text?: string };
  company?: {
    name?: string;
    size?: { text?: string };
    members?: Array<{
      person?: { name?: string };
      role?: { text?: string };
      since?: string;
    }>;
  };
  address?: { city?: string; state?: string; street?: string; number?: string; district?: string; zip?: string };
  phones?: Array<{ area: string; number: string }>;
  emails?: Array<{ address: string }>;
  mainActivity?: { text?: string; id?: string };
}) {
  const company = o.company || {}
  const address = o.address || {}
  return {
    cnpj: o.taxId,
    name: company.name || o.alias,
    alias: o.alias || company.name,
    phone: formatPhone(o.phones || []),
    email: formatEmail(o.emails || []),
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || '',
    street: address.street ? `${address.street}, ${address.number || ''}` : '',
    district: address.district || '',
    cnae: o.mainActivity?.text || '',
    cnaeCode: o.mainActivity?.id || '',
    status: o.status?.text || '',
    founded: o.founded || '',
    size: company.size?.text || '',
    members: (company.members || []).slice(0, 3).map((m) => ({
      name: m.person?.name || '',
      role: m.role?.text || '',
      since: m.since || ''
    })),
    source: 'CNPJ.já'
  }
}

async function getCnaeCodesForSegment(segment: string): Promise<string[]> {
  // Verificar mapeamento direto primeiro
  const lower = segment.toLowerCase().trim()
  for (const [key, codes] of Object.entries(CNAE_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return codes.slice(0, 4) // máximo 4 CNAEs para não sobrecarregar
    }
  }

  // Se não encontrou no mapeamento, usar IA para mapear
  try {
    const resp = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é especialista em classificação CNAE brasileira. Retorne SOMENTE um array JSON com os códigos CNAE mais relevantes (máximo 4 códigos, 7 dígitos cada). Sem texto adicional.'
        },
        {
          role: 'user',
          content: `Quais são os códigos CNAE (7 dígitos) mais relevantes para empresas do segmento "${segment}"? Retorne: ["0000000","0000000"]`
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    })
    const raw = (resp.choices[0]?.message?.content || '[]')
      .replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
    const codes = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]')
    if (Array.isArray(codes) && codes.length > 0) {
      return codes.slice(0, 4).map((c: string) => String(c).replace(/\D/g, ''))
    }
  } catch {
    // fallback
  }
  return []
}

// POST /api/search-companies
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, mode = 'name', state = '', limit = 10 } = body

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query é obrigatório' }, { status: 400 })
    }

    const limitNum = Math.min(parseInt(String(limit)) || 10, 20)

    if (mode === 'cnpj') {
      // Busca direta por CNPJ
      const clean = query.replace(/\D/g, '')
      if (clean.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
      }
      const res = await fetch(`${BASE_URL}/office/${clean}`, {
        headers: { Authorization: CNPJA_KEY }
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 })
      }
      const d = await res.json()
      return NextResponse.json({ results: [mapRecordToLead(d)], total: 1, verified: 1 })
    }

    if (mode === 'name') {
      // Busca por nome da empresa via /office com company.name.in
      const params = new URLSearchParams({
        'company.name.in': query.toUpperCase(),
        limit: String(limitNum)
      })
      if (state) params.append('address.state.in', state)

      const res = await fetch(`${BASE_URL}/office?${params}`, {
        headers: { Authorization: CNPJA_KEY }
      })
      if (!res.ok) {
        return NextResponse.json({ results: [], total: 0, message: `Nenhuma empresa encontrada para "${query}"` })
      }
      const d = await res.json()
      const records = d.records || []
      const results = records.map(mapRecordToLead)

      return NextResponse.json({
        results,
        total: results.length,
        totalFound: d.count || results.length,
        query, mode,
        verified: results.length
      })
    }

    if (mode === 'segment') {
      // Busca por segmento/CNAE
      const cnaeCodes = await getCnaeCodesForSegment(query)

      if (!cnaeCodes.length) {
        return NextResponse.json({
          results: [],
          total: 0,
          message: `Não foi possível identificar o segmento "${query}". Tente usar termos como: transporte, logística, tecnologia, saúde, varejo, construção, agro, etc.`
        })
      }

      const params = new URLSearchParams({
        'mainActivity.id.in': cnaeCodes.join(','),
        limit: String(limitNum)
      })
      if (state) params.append('address.state.in', state)

      const res = await fetch(`${BASE_URL}/office?${params}`, {
        headers: { Authorization: CNPJA_KEY }
      })
      if (!res.ok) {
        return NextResponse.json({ results: [], total: 0, message: `Erro ao buscar empresas do segmento "${query}"` })
      }
      const d = await res.json()
      const records = d.records || []
      const results = records.map(mapRecordToLead)

      return NextResponse.json({
        results,
        total: results.length,
        totalFound: d.count || results.length,
        query, mode,
        cnaeCodes,
        verified: results.length
      })
    }

    return NextResponse.json({ error: 'mode inválido' }, { status: 400 })

  } catch (err) {
    console.error('search-companies error:', err)
    return NextResponse.json({ error: 'Erro ao processar busca' }, { status: 500 })
  }
}
