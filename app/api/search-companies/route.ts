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

    // Prompt para o LLM gerar CNPJs reais
    const systemPrompt = `Você é um especialista em empresas brasileiras com acesso a dados da Receita Federal.
Sua tarefa é retornar uma lista de CNPJs reais e válidos de empresas brasileiras.
Retorne APENAS um JSON válido com o array de objetos, sem markdown, sem explicações.`

    let userPrompt = ''
    if (mode === 'name') {
      userPrompt = `Liste ${limitNum} empresas brasileiras reais cujo nome ou razão social contenha "${query}"${stateHint}.
Para cada empresa, forneça o CNPJ real (14 dígitos, apenas números), razão social e nome fantasia.
Retorne JSON: [{"cnpj": "12345678000100", "razao_social": "...", "nome_fantasia": "..."}]`
    } else {
      userPrompt = `Liste ${limitNum} empresas brasileiras reais do segmento de "${query}"${stateHint}.
Inclua empresas de diferentes portes (pequenas, médias e grandes).
Para cada empresa, forneça o CNPJ real (14 dígitos, apenas números), razão social e nome fantasia.
Retorne JSON: [{"cnpj": "12345678000100", "razao_social": "...", "nome_fantasia": "..."}]`
    }

    // Chamar o LLM para obter sugestões de CNPJs
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })

    const rawText = completion.choices[0]?.message?.content || '[]'

    // Extrair JSON da resposta
    let suggestions: Array<{ cnpj: string; razao_social?: string; nome_fantasia?: string }> = []
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch {
      return NextResponse.json({ results: [], total: 0, message: 'Não foi possível processar a busca.' })
    }

    if (!suggestions.length) {
      return NextResponse.json({ results: [], total: 0, message: `Nenhuma empresa encontrada para "${query}".` })
    }

    // Buscar dados reais no CNPJ.já para cada sugestão
    const results = await Promise.allSettled(
      suggestions.slice(0, limitNum).map(s => fetchCnpja(s.cnpj))
    )

    const validResults = results
      .map((r, i) => {
        if (r.status === 'fulfilled' && r.value) return r.value
        // Fallback: usar dados do LLM se CNPJ.já falhar
        const s = suggestions[i]
        return {
          cnpj: s.cnpj,
          name: s.razao_social || '',
          alias: s.nome_fantasia || s.razao_social || '',
          phone: '',
          email: '',
          city: state || '',
          state: state || '',
          cnae: mode === 'segment' ? query : '',
          status: 'Ativa',
          source: 'IA (não verificado)'
        }
      })
      .filter(r => r && r.name)

    return NextResponse.json({
      results: validResults,
      total: validResults.length,
      query,
      mode,
      verified: validResults.filter(r => r.source === 'CNPJ.já').length
    })

  } catch (err) {
    console.error('search-companies error:', err)
    return NextResponse.json({ error: 'Erro ao processar busca' }, { status: 500 })
  }
}
