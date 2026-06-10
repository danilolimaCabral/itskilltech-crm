import { NextRequest, NextResponse } from 'next/server'

const CNPJA_KEY = '9ad25b99-e3cf-448f-9449-836c4b68690b-65a8476e-a6fb-43c3-9202-2a8a3158f429'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cnpj = searchParams.get('cnpj')
  const nome = searchParams.get('nome')

  try {
    if (cnpj) {
      const cnpjLimpo = cnpj.replace(/\D/g, '')
      if (cnpjLimpo.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
      }

      const res = await fetch(`https://api.cnpja.com/office/${cnpjLimpo}?simples=true&registrations=BR`, {
        headers: {
          'Authorization': CNPJA_KEY,
          'Accept': 'application/json'
        }
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `CNPJ não encontrado: ${err}` }, { status: 404 })
      }

      const data = await res.json()
      return NextResponse.json(formatCNPJA(data))
    }

    if (nome) {
      if (nome.length < 3) {
        return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 })
      }

      const res = await fetch(
        `https://api.cnpja.com/office/search?query=${encodeURIComponent(nome)}&limit=10`,
        {
          headers: {
            'Authorization': CNPJA_KEY,
            'Accept': 'application/json'
          }
        }
      )

      if (!res.ok) {
        // Fallback para BrasilAPI
        const res2 = await fetch(
          `https://brasilapi.com.br/api/cnpj/v1/search?query=${encodeURIComponent(nome)}&limit=10`,
          { headers: { 'Accept': 'application/json' } }
        )
        if (!res2.ok) return NextResponse.json({ results: [] })
        const data2 = await res2.json()
        const results = Array.isArray(data2) ? data2.map(formatBrasilAPI) : []
        return NextResponse.json({ results })
      }

      const data = await res.json()
      const results = Array.isArray(data?.offices) ? data.offices.map(formatCNPJA) : []
      return NextResponse.json({ results })
    }

    return NextResponse.json({ error: 'Informe cnpj ou nome' }, { status: 400 })

  } catch (error) {
    console.error('Erro busca empresa:', error)
    return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
  }
}

function formatCNPJA(data: any) {
  const company = data.company || {}
  const address = data.address || {}
  const phones = data.phones || []
  const emails = data.emails || []
  const socios = company.members || []

  const tel = phones[0]?.number || ''
  const telArea = phones[0]?.area || ''
  const telFormatado = telArea && tel ? `(${telArea}) ${tel}` : tel

  const mainActivity = company.mainActivity?.text || data.mainActivity?.text || ''

  return {
    cnpj: data.taxId || '',
    razao_social: company.name || '',
    nome_fantasia: data.alias || '',
    situacao: data.status?.text || '',
    atividade_principal: mainActivity,
    logradouro: address.street || '',
    numero: address.number || '',
    complemento: address.details || '',
    bairro: address.district || '',
    municipio: address.city || '',
    uf: address.state || '',
    cep: address.zip || '',
    email: emails[0]?.address || '',
    telefone: telFormatado,
    porte: company.size?.text || '',
    natureza_juridica: company.nature?.text || '',
    capital_social: company.equity || 0,
    data_inicio_atividade: data.founded || '',
    socios: socios.map((s: any) => ({
      nome: s.person?.name || s.name || '',
      qualificacao: s.role?.text || ''
    }))
  }
}

function formatBrasilAPI(data: any) {
  const telefone = data.ddd_telefone_1 || ''
  const tel = telefone.replace(/\D/g, '')
  const telFormatado = tel.length >= 10
    ? `(${tel.slice(0, 2)}) ${tel.slice(2, tel.length > 10 ? 7 : 6)}-${tel.slice(tel.length > 10 ? 7 : 6)}`
    : telefone

  return {
    cnpj: data.cnpj || '',
    razao_social: data.razao_social || '',
    nome_fantasia: data.nome_fantasia || '',
    situacao: data.descricao_situacao_cadastral || '',
    atividade_principal: data.cnae_fiscal_descricao || '',
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    uf: data.uf || '',
    cep: data.cep || '',
    email: data.email || '',
    telefone: telFormatado,
    porte: data.porte || '',
    natureza_juridica: data.natureza_juridica || '',
    capital_social: data.capital_social || 0,
    data_inicio_atividade: data.data_inicio_atividade || '',
    socios: Array.isArray(data.qsa) ? data.qsa.map((s: any) => ({
      nome: s.nome_socio,
      qualificacao: s.qualificacao_socio
    })) : []
  }
}
