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

// GET /api/cnpja?cnpj=53113791000122
// GET /api/cnpja?name=TOTVS  (busca por nome via BrasilAPI + enriquece com CNPJ.já)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cnpj = searchParams.get('cnpj')
  const name = searchParams.get('name')

  if (!cnpj && !name) {
    return NextResponse.json({ error: 'Informe cnpj ou name' }, { status: 400 })
  }

  try {
    if (cnpj) {
      // Consulta direta por CNPJ
      const cleanCnpj = formatCNPJ(cnpj)
      const res = await fetch(`${BASE_URL}/office/${cleanCnpj}`, {
        headers: { Authorization: CNPJA_KEY },
        next: { revalidate: 3600 }
      })

      if (!res.ok) {
        // Fallback para BrasilAPI se CNPJ.já falhar
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
      const company = d.company || {}
      
      return NextResponse.json({
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
      })
    }

    if (name) {
      // Busca por nome: primeiro tenta BrasilAPI para descobrir o CNPJ
      // depois enriquece com CNPJ.já
      const searchRes = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/search?q=${encodeURIComponent(name)}&limit=5`
      )
      
      // BrasilAPI não tem busca por nome, então usamos a Minha Receita
      const minhaReceitaRes = await fetch(
        `https://minhareceita.org/search?q=${encodeURIComponent(name)}&limit=5`
      )

      if (minhaReceitaRes.ok) {
        const results = await minhaReceitaRes.json()
        const companies = Array.isArray(results) ? results : results.data || []
        
        // Enriquecer o primeiro resultado com CNPJ.já
        const enriched = await Promise.all(
          companies.slice(0, 5).map(async (c: { cnpj: string; razao_social: string; nome_fantasia?: string; municipio?: string; uf?: string }) => {
            try {
              const cleanCnpj = formatCNPJ(c.cnpj)
              const enrichRes = await fetch(`${BASE_URL}/office/${cleanCnpj}`, {
                headers: { Authorization: CNPJA_KEY },
              })
              if (enrichRes.ok) {
                const d = await enrichRes.json()
                const company = d.company || {}
                return {
                  cnpj: d.taxId,
                  name: company.name || d.alias || c.razao_social,
                  alias: d.alias || c.nome_fantasia || c.razao_social,
                  phone: formatPhone(d.phones || []),
                  email: formatEmail(d.emails || []),
                  city: d.address?.city || c.municipio || '',
                  state: d.address?.state || c.uf || '',
                  cnae: d.mainActivity?.text || '',
                  status: d.status?.text || '',
                  members: (company.members || []).slice(0, 3).map((m: {
                    person?: { name?: string }
                    role?: { text?: string }
                  }) => ({
                    name: m.person?.name || '',
                    role: m.role?.text || ''
                  })),
                  source: 'CNPJ.já'
                }
              }
            } catch {}
            return {
              cnpj: c.cnpj,
              name: c.razao_social,
              alias: c.nome_fantasia || c.razao_social,
              city: c.municipio || '',
              state: c.uf || '',
              source: 'BrasilAPI'
            }
          })
        )
        return NextResponse.json({ results: enriched })
      }

      return NextResponse.json({ error: 'Busca por nome não disponível. Use o CNPJ diretamente.' }, { status: 400 })
    }

  } catch (err) {
    console.error('CNPJ.já error:', err)
    return NextResponse.json({ error: 'Erro ao consultar API' }, { status: 500 })
  }
}
