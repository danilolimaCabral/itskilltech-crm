import { NextRequest, NextResponse } from 'next/server'

const CNPJA_KEY = process.env.CNPJA_API_KEY || ''
const BASE_URL = 'https://api.cnpja.com'

function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

function formatPhone(phones: Array<{ type: string; area: string; number: string }>): string {
  if (!phones || phones.length === 0) return ''
  const p = phones[0]
  return `(${p.area}) ${p.number.slice(0, p.number.length - 4)}-${p.number.slice(-4)}`
}

function formatEmail(emails: Array<{ ownership: string; address: string }>): string {
  if (!emails || emails.length === 0) return ''
  return emails[0].address
}

function mapCnpjaOffice(d: any) {
  const company = d.company || {}
  return {
    cnpj: d.taxId,
    name: company.name || d.alias,
    alias: d.alias || company.name,
    phone: formatPhone(d.phones || []),
    email: formatEmail(d.emails || []),
    city: d.address?.city || '',
    state: d.address?.state || '',
    zip: d.address?.zip || '',
    street: d.address?.street ? `${d.address.street}, ${d.address.number || ''}` : '',
    district: d.address?.district || '',
    cnae: d.mainActivity?.text || '',
    cnaeCode: d.mainActivity?.id || '',
    status: d.status?.text || '',
    founded: d.founded || '',
    size: company.size?.text || '',
    equity: company.equity || 0,
    members: (company.members || []).slice(0, 5).map((m: {
      person?: { name?: string }
      role?: { text?: string }
      since?: string
    }) => ({
      name: m.person?.name || '',
      role: m.role?.text || '',
      since: m.since || ''
    })),
    sideActivities: (d.sideActivities || []).slice(0, 5).map((a: { text: string }) => a.text),
    source: 'CNPJ.já'
  }
}

// GET /api/cnpja?cnpj=53113791000122
// GET /api/cnpja?name=TOTVS
// GET /api/cnpja?segment=transporte%20de%20cargas&state=PR&limit=10
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cnpj = searchParams.get('cnpj')
  const name = searchParams.get('name')
  const segment = searchParams.get('segment')
  const state = searchParams.get('state') || ''
  const city = searchParams.get('city') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

  if (!cnpj && !name && !segment) {
    return NextResponse.json({ error: 'Informe cnpj, name ou segment' }, { status: 400 })
  }

  try {
    // ── 1. Busca por CNPJ ──────────────────────────────────────────────────
    if (cnpj) {
      const cleanCnpj = formatCNPJ(cnpj)
      const res = await fetch(`${BASE_URL}/office/${cleanCnpj}`, {
        headers: { Authorization: CNPJA_KEY },
        next: { revalidate: 3600 }
      })

      if (!res.ok) {
        // Fallback BrasilAPI
        const fallback = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
        if (!fallback.ok) {
          return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 })
        }
        const fb = await fallback.json()
        return NextResponse.json({
          cnpj: fb.cnpj,
          name: fb.razao_social,
          alias: fb.nome_fantasia || fb.razao_social,
          phone: fb.ddd_telefone_1 ? `(${fb.ddd_telefone_1.slice(0,2)}) ${fb.ddd_telefone_1.slice(2)}` : '',
          email: fb.email || '',
          city: fb.municipio,
          state: fb.uf,
          zip: fb.cep,
          street: `${fb.logradouro}, ${fb.numero}`,
          district: fb.bairro,
          cnae: fb.cnae_fiscal_descricao || '',
          status: fb.situacao_cadastral === 'ATIVA' ? 'Ativa' : fb.situacao_cadastral,
          members: fb.qsa?.map((m: { nome_socio: string; qualificacao_socio: string }) => ({
            name: m.nome_socio,
            role: m.qualificacao_socio
          })) || [],
          source: 'BrasilAPI'
        })
      }
      const d = await res.json()
      return NextResponse.json(mapCnpjaOffice(d))
    }

    // ── 2. Busca por nome via CNPJ.já search ──────────────────────────────
    if (name) {
      // Tenta CNPJ.já search endpoint
      const params = new URLSearchParams({ company: name, limit: String(limit) })
      if (state) params.set('state', state)
      const searchRes = await fetch(`${BASE_URL}/search?${params}`, {
        headers: { Authorization: CNPJA_KEY },
      })

      if (searchRes.ok) {
        const data = await searchRes.json()
        const offices = data.offices || data.results || []
        const results = offices.slice(0, limit).map((o: any) => {
          const company = o.company || {}
          return {
            cnpj: o.taxId || o.cnpj,
            name: company.name || o.alias || o.name,
            alias: o.alias || company.name,
            phone: formatPhone(o.phones || []),
            email: formatEmail(o.emails || []),
            city: o.address?.city || '',
            state: o.address?.state || '',
            cnae: o.mainActivity?.text || '',
            status: o.status?.text || 'Ativa',
            size: company.size?.text || '',
            members: (company.members || []).slice(0, 3).map((m: any) => ({
              name: m.person?.name || '',
              role: m.role?.text || ''
            })),
            source: 'CNPJ.já'
          }
        })
        return NextResponse.json({ results, total: data.total || results.length })
      }

      // Fallback: BrasilAPI não tem busca por nome, retorna orientação
      return NextResponse.json({
        results: [],
        total: 0,
        message: 'Busca por nome requer plano CNPJ.já. Tente buscar pelo CNPJ diretamente.'
      })
    }

    // ── 3. Busca por segmento/CNAE ─────────────────────────────────────────
    if (segment) {
      // Mapeamento de segmentos comuns para códigos CNAE
      const cnaeMap: Record<string, string[]> = {
        'transporte': ['4930', '4921', '4922', '4923', '4924', '4929', '5011', '5012'],
        'logistica': ['5211', '5212', '5229', '5231', '5232', '5239', '5240'],
        'tms': ['4930', '5211', '5212', '5229'],
        'atacado': ['4639', '4641', '4642', '4643', '4644', '4645', '4646', '4647', '4649'],
        'tecnologia': ['6201', '6202', '6203', '6204', '6209', '6311', '6319'],
        'software': ['6201', '6202', '6203', '6204', '6209'],
        'industria': ['2511', '2512', '2513', '2521', '2522', '2531', '2532'],
        'saude': ['8610', '8621', '8622', '8630', '8640', '8650', '8660'],
        'varejo': ['4711', '4712', '4713', '4721', '4722', '4723', '4724', '4729'],
        'alimentos': ['1011', '1012', '1013', '1020', '1031', '1032', '1033'],
        'construcao': ['4110', '4120', '4211', '4212', '4213', '4221', '4222'],
        'agro': ['0111', '0112', '0113', '0114', '0115', '0116', '0119'],
        'financeiro': ['6411', '6412', '6421', '6422', '6423', '6424', '6431'],
        'educacao': ['8511', '8512', '8513', '8520', '8531', '8532', '8541'],
      }

      // Detecta se o segmento é um código CNAE direto (4 dígitos) ou palavra-chave
      const segLower = segment.toLowerCase().trim()
      let cnaeCodes: string[] = []

      // Verifica se é código numérico
      if (/^\d{4,7}$/.test(segLower)) {
        cnaeCodes = [segLower.slice(0, 4)]
      } else {
        // Busca por palavra-chave no mapeamento
        for (const [key, codes] of Object.entries(cnaeMap)) {
          if (segLower.includes(key) || key.includes(segLower)) {
            cnaeCodes = codes
            break
          }
        }
      }

      // Tenta CNPJ.já search por atividade principal
      const searchParams2 = new URLSearchParams({ limit: String(limit) })
      if (state) searchParams2.set('state', state)
      if (city) searchParams2.set('city', city)

      // Se temos códigos CNAE, usa o primeiro para filtrar
      if (cnaeCodes.length > 0) {
        searchParams2.set('mainActivity', cnaeCodes[0])
      } else {
        // Busca por nome da atividade
        searchParams2.set('company', segment)
      }

      const segRes = await fetch(`${BASE_URL}/search?${searchParams2}`, {
        headers: { Authorization: CNPJA_KEY },
      })

      if (segRes.ok) {
        const data = await segRes.json()
        const offices = data.offices || data.results || []
        const results = offices.slice(0, limit).map((o: any) => {
          const company = o.company || {}
          return {
            cnpj: o.taxId || o.cnpj,
            name: company.name || o.alias || o.name,
            alias: o.alias || company.name,
            phone: formatPhone(o.phones || []),
            email: formatEmail(o.emails || []),
            city: o.address?.city || '',
            state: o.address?.state || '',
            cnae: o.mainActivity?.text || '',
            cnaeCode: o.mainActivity?.id || '',
            status: o.status?.text || 'Ativa',
            size: company.size?.text || '',
            members: (company.members || []).slice(0, 3).map((m: any) => ({
              name: m.person?.name || '',
              role: m.role?.text || ''
            })),
            source: 'CNPJ.já'
          }
        })
        return NextResponse.json({
          results,
          total: data.total || results.length,
          segment,
          cnaeCodes: cnaeCodes.length > 0 ? cnaeCodes : undefined
        })
      }

      // Fallback: busca na ReceitaWS por CNAE
      if (cnaeCodes.length > 0) {
        try {
          const receitaRes = await fetch(
            `https://receitaws.com.br/v1/cnpj/search?atividade=${cnaeCodes[0]}&uf=${state}&limit=${limit}`,
            { next: { revalidate: 3600 } }
          )
          if (receitaRes.ok) {
            const data = await receitaRes.json()
            const results = (data.empresas || []).slice(0, limit).map((e: any) => ({
              cnpj: e.cnpj,
              name: e.razao_social,
              alias: e.nome_fantasia || e.razao_social,
              city: e.municipio || '',
              state: e.uf || '',
              cnae: e.cnae_fiscal_descricao || '',
              status: e.situacao_cadastral === 'ATIVA' ? 'Ativa' : e.situacao_cadastral,
              source: 'ReceitaWS'
            }))
            return NextResponse.json({ results, total: results.length, segment })
          }
        } catch {}
      }

      return NextResponse.json({
        results: [],
        total: 0,
        segment,
        message: `Nenhuma empresa encontrada para o segmento "${segment}". Tente um termo diferente ou busque pelo CNPJ.`
      })
    }

  } catch (err) {
    console.error('CNPJ.já error:', err)
    return NextResponse.json({ error: 'Erro ao consultar API' }, { status: 500 })
  }
}
