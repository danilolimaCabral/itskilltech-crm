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

// Validar dígitos verificadores do CNPJ
function validateCnpj(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return false
  if (/^(\d)\1+$/.test(c)) return false
  const calc = (str: string, weights: number[]) =>
    str.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0)
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  const d1 = 11 - (calc(c.slice(0,12), w1) % 11)
  const d2 = 11 - (calc(c.slice(0,13), w2) % 11)
  return parseInt(c[12]) === (d1 >= 10 ? 0 : d1) && parseInt(c[13]) === (d2 >= 10 ? 0 : d2)
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

    // Prompt melhorado para o LLM gerar CNPJs reais e verificáveis
    const systemPrompt = `Você é um especialista em empresas brasileiras.
Você conhece CNPJs reais de empresas brasileiras cadastradas na Receita Federal.
Retorne APENAS JSON válido, sem markdown, sem explicações, sem código.
Os CNPJs devem ser REAIS e VÁLIDOS (passar no algoritmo de verificação da Receita Federal).
Forneça apenas empresas que você tem certeza que existem com esses CNPJs.`

    let userPrompt = ''
    if (mode === 'name') {
      userPrompt = `Forneça ${limitNum} CNPJs reais de empresas brasileiras cujo nome contenha "${query}"${stateHint}.
Inclua a matriz e filiais se conhecer.
Retorne SOMENTE este JSON (sem texto adicional):
[{"cnpj":"00000000000000","razao_social":"NOME COMPLETO","nome_fantasia":"NOME FANTASIA"}]`
    } else {
      userPrompt = `Forneça ${limitNum} CNPJs reais de empresas brasileiras do segmento "${query}"${stateHint}.
Inclua empresas de diferentes portes. Prefira empresas conhecidas e médias/grandes.
Retorne SOMENTE este JSON (sem texto adicional):
[{"cnpj":"00000000000000","razao_social":"NOME COMPLETO","nome_fantasia":"NOME FANTASIA"}]`
    }

    // Usar Gemini que tem mais conhecimento factual
    const completion = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const rawText = completion.choices[0]?.message?.content || '[]'

    // Extrair JSON da resposta
    let suggestions: Array<{ cnpj: string; razao_social?: string; nome_fantasia?: string }> = []
    try {
      // Tentar extrair JSON de diferentes formatos
      const jsonMatch = rawText.match(/\[[\s\S]*?\]/s) || rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      } else {
        // Tentar parsear diretamente
        suggestions = JSON.parse(rawText)
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

    // Filtrar CNPJs válidos
    const validSuggestions = suggestions
      .filter(s => s.cnpj && validateCnpj(s.cnpj.replace(/\D/g, '')))
      .slice(0, limitNum)

    if (!validSuggestions.length) {
      // Se nenhum CNPJ válido, tentar buscar sem validação (o CNPJ.já vai rejeitar os inválidos)
      const allSuggestions = suggestions.slice(0, limitNum)
      const results = await Promise.allSettled(
        allSuggestions.map(s => fetchCnpja(s.cnpj))
      )
      const validResults = results
        .map(r => r.status === 'fulfilled' ? r.value : null)
        .filter(Boolean)

      if (validResults.length === 0) {
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
    }

    // Buscar dados reais no CNPJ.já para cada sugestão válida
    const results = await Promise.allSettled(
      validSuggestions.map(s => fetchCnpja(s.cnpj))
    )

    const validResults = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean)

    if (validResults.length === 0) {
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
