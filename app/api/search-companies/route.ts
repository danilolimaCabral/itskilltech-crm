import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const CNPJA_KEY = process.env.CNPJA_API_KEY || ''
const BASE_URL = 'https://api.cnpja.com'

const openai = new OpenAI()

function formatPhone(phones: Array<{ area: string; number: string }> = []): string {
  if (!phones.length) return ''
  const p = phones[0]
  return `(${p.area}) ${p.number.slice(0, p.number.length - 4)}-${p.number.slice(-4)}`
}

function formatEmail(emails: Array<{ address: string }> = []): string {
  return emails[0]?.address || ''
}

async function fetchCnpja(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return null
  try {
    const res = await fetch(`${BASE_URL}/office/${clean}`, {
      headers: { Authorization: CNPJA_KEY },
      next: { revalidate: 3600 }
    })
    if (!res.ok) return null
    const d = await res.json()
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
      members: (company.members || []).slice(0, 3).map((m: {
        person?: { name?: string }
        role?: { text?: string }
      }) => ({
        name: m.person?.name || '',
        role: m.role?.text || ''
      })),
      source: 'CNPJ.já'
    }
  } catch {
    return null
  }
}

// POST /api/search-companies
// Body: { query: string, mode: 'name' | 'segment', state?: string, limit?: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, mode = 'name', state = '', limit = 10 } = body

    if (!query?.trim()) {
      return NextResponse.json({ error: 'query é obrigatório' }, { status: 400 })
    }

    const stateHint = state ? ` no estado ${state}` : ' no Brasil'
    const limitNum = Math.min(parseInt(String(limit)) || 10, 15)

    // Pedir ao Gemini para sugerir CNPJs reais
    // Para segmento: pedir mais CNPJs pois muitos podem ser inválidos
    const askCount = mode === 'segment' ? Math.min(limitNum * 3, 30) : Math.min(limitNum * 2, 20)

    let systemPrompt: string
    let userPrompt: string

    if (mode === 'name') {
      systemPrompt = `Você é um especialista em empresas brasileiras.
Você conhece os CNPJs REAIS de empresas brasileiras registradas na Receita Federal.
Retorne SOMENTE JSON válido, sem markdown, sem texto adicional.`

      userPrompt = `Forneça ${askCount} CNPJs reais de empresas brasileiras cujo nome ou razão social contenha "${query}"${stateHint}.
Inclua a matriz e filiais principais se conhecer.
IMPORTANTE: Os CNPJs devem ser REAIS e EXATOS como registrados na Receita Federal.
Retorne SOMENTE este JSON (sem texto adicional, sem markdown):
[{"cnpj":"XX.XXX.XXX/XXXX-XX","razao_social":"NOME COMPLETO","nome_fantasia":"NOME FANTASIA"}]`
    } else {
      systemPrompt = `Você é um especialista em empresas brasileiras.
Você conhece empresas de todos os setores da economia brasileira.
Retorne SOMENTE JSON válido, sem markdown, sem texto adicional.`

      userPrompt = `Liste ${askCount} empresas brasileiras do segmento/setor de "${query}"${stateHint}.
Inclua empresas conhecidas de diferentes portes (grandes, médias e pequenas).
Para cada empresa, forneça o CNPJ mais provável no formato XX.XXX.XXX/0001-XX.
Prefira empresas com presença nacional conhecida no setor de "${query}".
Retorne SOMENTE este JSON (sem texto adicional, sem markdown):
[{"cnpj":"XX.XXX.XXX/0001-XX","razao_social":"NOME COMPLETO","nome_fantasia":"NOME FANTASIA"}]`
    }

    const completion = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 3000
    })

    const rawText = completion.choices[0]?.message?.content || '[]'

    // Extrair JSON da resposta (lidar com markdown do Gemini)
    let suggestions: Array<{ cnpj: string; razao_social?: string; nome_fantasia?: string }> = []
    try {
      // Remover markdown code blocks
      const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
      try {
        suggestions = JSON.parse(cleaned)
      } catch {
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON array found')
        }
      }
    } catch {
      return NextResponse.json({
        results: [],
        total: 0,
        message: `Não foi possível processar a busca para "${query}". Tente buscar por CNPJ diretamente.`
      })
    }

    if (!suggestions.length) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: `Nenhuma empresa encontrada para "${query}". Tente buscar por CNPJ diretamente.`
      })
    }

    // Deduplicate CNPJs
    const seen = new Set<string>()
    const uniqueSuggestions = suggestions.filter(s => {
      const clean = s.cnpj?.replace(/\D/g, '') || ''
      if (!clean || seen.has(clean)) return false
      seen.add(clean)
      return true
    })

    // Buscar dados reais no CNPJ.já para cada sugestão (sem validar dígitos verificadores)
    // O CNPJ.já vai rejeitar os inválidos
    const results = await Promise.allSettled(
      uniqueSuggestions.slice(0, askCount).map(s => fetchCnpja(s.cnpj))
    )

    const validResults = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean)
      .slice(0, limitNum)

    if (validResults.length === 0) {
      // Para segmento, retornar resultados "não verificados" como fallback
      if (mode === 'segment') {
        const fallback = uniqueSuggestions.slice(0, limitNum).map(s => ({
          cnpj: s.cnpj?.replace(/\D/g, '') || '',
          name: s.razao_social || '',
          alias: s.nome_fantasia || s.razao_social || '',
          phone: '', email: '', city: '', state: state || '',
          cnae: query, status: '', founded: '', size: '',
          members: [], source: 'IA (não verificado)'
        }))
        return NextResponse.json({
          results: fallback,
          total: fallback.length,
          query, mode,
          verified: 0,
          message: `Resultados sugeridos por IA para "${query}" — não verificados na Receita Federal. Para dados precisos, busque pelo CNPJ.`
        })
      }
      return NextResponse.json({
        results: [],
        total: 0,
        message: `Não encontrei empresas verificadas para "${query}"${stateHint}. Tente buscar por CNPJ diretamente ou use termos mais específicos.`
      })
    }

    return NextResponse.json({
      results: validResults,
      total: validResults.length,
      query,
      mode,
      verified: validResults.length
    })

  } catch (err) {
    console.error('search-companies error:', err)
    return NextResponse.json({ error: 'Erro ao processar busca' }, { status: 500 })
  }
}
