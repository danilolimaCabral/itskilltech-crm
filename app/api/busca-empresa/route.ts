import { NextRequest, NextResponse } from 'next/server'

const CNPJA_KEY = '9ad25b99-e3cf-448f-9449-836c4b68690b-65a8476e-a6fb-43c3-9202-2a8a3158f429'
const BASE_URL = 'https://api.cnpja.com'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cnpj = searchParams.get('cnpj')
  const nome = searchParams.get('nome')

  try {
    // ── Busca por CNPJ ──────────────────────────────────────────────────────
    if (cnpj) {
      const cnpjLimpo = cnpj.replace(/\D/g, '')
      if (cnpjLimpo.length !== 14) {
        return NextResponse.json({ error: 'CNPJ inválido — digite os 14 dígitos' }, { status: 400 })
      }

      const res = await fetch(`${BASE_URL}/office/${cnpjLimpo}?simples=true&registrations=BR`, {
        headers: {
          'Authorization': CNPJA_KEY,
          'Accept': 'application/json'
        }
      })

      if (!res.ok) {
        // Fallback para BrasilAPI
        const res2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
          headers: { 'Accept': 'application/json' }
        })
        if (!res2.ok) {
          return NextResponse.json({ error: 'CNPJ não encontrado na Receita Federal' }, { status: 404 })
        }
        const data2 = await res2.json()
        return NextResponse.json(formatBrasilAPI(data2))
      }

      const data = await res.json()
      return NextResponse.json(formatCNPJA(data))
    }

    // ── Busca por Nome via CNPJ.já ──────────────────────────────────────────
    if (nome) {
      if (nome.length < 3) {
        return NextResponse.json({ error: 'Digite pelo menos 3 letras' }, { status: 400 })
      }

      // Busca real via CNPJ.já usando endpoint /office com filtro por nome
      const params = new URLSearchParams({
        'company.name.in': nome,
        limit: '10'
      })

      const searchRes = await fetch(`${BASE_URL}/office?${params}`, {
        headers: {
          'Authorization': CNPJA_KEY,
          'Accept': 'application/json'
        }
      })

      if (searchRes.ok) {
        const data = await searchRes.json()
        const offices = data.records || data.offices || data.results || []

        if (offices.length === 0) {
          return NextResponse.json({
            results: [],
            total: 0,
            message: `Nenhuma empresa encontrada com o nome "${nome}". Tente buscar pelo CNPJ.`
          })
        }

        const results = offices.slice(0, 10).map((o: any) => {
          const company = o.company || {}
          const phones = o.phones || []
          const emails = o.emails || []
          const telArea = phones[0]?.area || ''
          const tel = phones[0]?.number || ''
          const telFormatado = telArea && tel ? `(${telArea}) ${tel}` : tel

          return {
            cnpj: o.taxId || o.cnpj || '',
            razao_social: company.name || o.alias || o.name || '',
            nome_fantasia: o.alias || company.name || '',
            situacao: o.status?.text || 'Ativa',
            atividade_principal: o.mainActivity?.text || '',
            logradouro: o.address?.street || '',
            numero: o.address?.number || '',
            bairro: o.address?.district || '',
            municipio: o.address?.city || '',
            uf: o.address?.state || '',
            cep: o.address?.zip || '',
            email: emails[0]?.address || '',
            telefone: telFormatado,
            porte: company.size?.text || '',
            natureza_juridica: company.nature?.text || '',
            capital_social: company.equity || 0,
            data_inicio_atividade: o.founded || '',
            socios: (company.members || []).slice(0, 3).map((m: any) => ({
              nome: m.person?.name || m.name || '',
              qualificacao: m.role?.text || ''
            })),
            source: 'CNPJ.já'
          }
        })

        return NextResponse.json({ results, total: data.total || results.length })
      }

      // Se CNPJ.já falhar (plano não suporta), tentar busca alternativa via ReceitaWS
      const receitaRes = await fetch(`https://www.receitaws.com.br/v1/cnpj/search?q=${encodeURIComponent(nome)}`, {
        headers: { 'Accept': 'application/json' }
      }).catch(() => null)

      if (receitaRes?.ok) {
        const receitaData = await receitaRes.json()
        if (receitaData.empresas?.length > 0) {
          const results = receitaData.empresas.slice(0, 10).map((e: any) => ({
            cnpj: e.cnpj || '',
            razao_social: e.nome || '',
            nome_fantasia: e.fantasia || e.nome || '',
            situacao: e.situacao || 'Ativa',
            atividade_principal: e.atividade_principal?.[0]?.text || '',
            municipio: e.municipio || '',
            uf: e.uf || '',
            email: e.email || '',
            telefone: e.telefone || '',
            porte: e.porte || '',
            data_inicio_atividade: e.abertura || '',
            socios: (e.qsa || []).slice(0, 3).map((s: any) => ({
              nome: s.nome || '',
              qualificacao: s.qual || ''
            })),
            source: 'ReceitaWS'
          }))
          return NextResponse.json({ results, total: results.length })
        }
      }

      // Fallback final: sugerir Google
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`CNPJ "${nome}" site:cnpj.biz OR site:receitaws.com.br`)}`
      return NextResponse.json({
        suggestion: true,
        message: `Não foi possível encontrar "${nome}" automaticamente. Cole o CNPJ no campo acima ou busque no Google.`,
        googleUrl,
        googleLabel: `🔍 Buscar CNPJ de "${nome}" no Google`
      })
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
