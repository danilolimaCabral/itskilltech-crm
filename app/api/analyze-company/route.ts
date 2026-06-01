import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const CNPJA_KEY = process.env.CNPJA_API_KEY || ''
const openai = new OpenAI()

export async function POST(req: NextRequest) {
  try {
    const { company, cnpj, leadName, leadRole } = await req.json()
    if (!company && !cnpj) return NextResponse.json({ error: 'company ou cnpj obrigatório' }, { status: 400 })

    let cnpjaData: any = null
    let cnpjaError = ''

    // 1. Buscar no CNPJ.já
    if (cnpj) {
      const clean = cnpj.replace(/\D/g, '')
      if (clean.length === 14) {
        try {
          const r = await fetch(`https://api.cnpja.com/office/${clean}`, {
            headers: { Authorization: CNPJA_KEY }
          })
          if (r.ok) cnpjaData = await r.json()
        } catch { cnpjaError = 'CNPJ.já indisponível' }
      }
    }

    // Se não tem CNPJ, buscar pelo nome
    if (!cnpjaData && company) {
      try {
        const params = new URLSearchParams({
          'company.name.in': company.toUpperCase(),
          limit: '1'
        })
        const r = await fetch(`https://api.cnpja.com/office?${params}`, {
          headers: { Authorization: CNPJA_KEY }
        })
        if (r.ok) {
          const d = await r.json()
          if (d.records?.length > 0) {
            // Buscar detalhes completos do primeiro resultado
            const taxId = d.records[0].taxId
            const r2 = await fetch(`https://api.cnpja.com/office/${taxId}`, {
              headers: { Authorization: CNPJA_KEY }
            })
            if (r2.ok) cnpjaData = await r2.json()
          }
        }
      } catch { cnpjaError = 'Busca por nome falhou' }
    }

    // 2. Montar contexto da empresa
    let companyContext = ''
    if (cnpjaData) {
      const c = cnpjaData.company || {}
      const addr = cnpjaData.address || {}
      const phones = (cnpjaData.phones || []).map((p: any) => `(${p.area}) ${p.number}`).join(', ')
      const emails = (cnpjaData.emails || []).map((e: any) => e.address).join(', ')
      const members = (c.members || []).slice(0, 5).map((m: any) => `${m.person?.name || ''} (${m.role?.text || ''})`).join(', ')
      const cnae = cnpjaData.mainActivity?.text || ''
      const sideActivities = (cnpjaData.sideActivities || []).slice(0, 3).map((a: any) => a.text).join(', ')

      companyContext = `
DADOS OFICIAIS (Receita Federal via CNPJ.já):
- Razão Social: ${c.name || ''}
- Nome Fantasia: ${cnpjaData.alias || ''}
- CNPJ: ${cnpjaData.taxId || ''}
- Atividade Principal (CNAE): ${cnae}
- Atividades Secundárias: ${sideActivities}
- Porte: ${c.size?.text || ''}
- Capital Social: R$ ${((c.equity || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Natureza Jurídica: ${c.nature?.text || ''}
- Fundada em: ${cnpjaData.founded || ''}
- Status: ${cnpjaData.status?.text || ''}
- Endereço: ${addr.street || ''}, ${addr.number || ''}, ${addr.district || ''}, ${addr.city || ''}/${addr.state || ''} - CEP ${addr.zip || ''}
- Telefones: ${phones}
- E-mails: ${emails}
- Sócios/Diretores: ${members}
- Simples Nacional: ${cnpjaData.company?.simples?.optant ? 'Sim' : 'Não'}
`
    } else {
      companyContext = `Empresa: ${company}\n${cnpjaError ? `(Dados da Receita Federal não disponíveis: ${cnpjaError})` : ''}`
    }

    // 3. Gerar análise com IA
    const prompt = `Você é um especialista em vendas B2B e inteligência comercial.
Analise a empresa abaixo e gere um briefing estratégico para um vendedor que vai entrar em contato com ${leadName || 'um decisor'}${leadRole ? ` (${leadRole})` : ''}.

${companyContext}

Gere um briefing em JSON com exatamente esta estrutura:
{
  "resumo": "2-3 frases sobre o que a empresa faz e seu posicionamento no mercado",
  "porte_analise": "análise do porte e maturidade da empresa (1 frase)",
  "dores_provaveis": ["dor 1 relacionada ao segmento", "dor 2", "dor 3"],
  "oportunidades": ["oportunidade de venda 1", "oportunidade 2"],
  "abordagem_sugerida": "como abordar este lead especificamente (2-3 frases práticas)",
  "perguntas_abertura": ["pergunta para descobrir necessidade 1", "pergunta 2", "pergunta 3"],
  "alertas": ["alerta ou ponto de atenção 1 se houver"],
  "score_potencial": 7
}

score_potencial: número de 1 a 10 indicando o potencial de conversão.
Retorne SOMENTE o JSON, sem markdown, sem texto adicional.`

    const completion = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500
    })

    const raw = (completion.choices[0]?.message?.content || '{}')
      .replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()

    let analysis: any = {}
    try {
      analysis = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}')
    } catch {
      analysis = { resumo: 'Análise gerada com sucesso.', abordagem_sugerida: raw.slice(0, 300) }
    }

    return NextResponse.json({
      ok: true,
      company: cnpjaData ? {
        name: cnpjaData.company?.name || company,
        alias: cnpjaData.alias || '',
        cnpj: cnpjaData.taxId || '',
        cnae: cnpjaData.mainActivity?.text || '',
        size: cnpjaData.company?.size?.text || '',
        city: cnpjaData.address?.city || '',
        state: cnpjaData.address?.state || '',
        founded: cnpjaData.founded || '',
        phones: (cnpjaData.phones || []).map((p: any) => `(${p.area}) ${p.number}`),
        emails: (cnpjaData.emails || []).map((e: any) => e.address),
        members: (cnpjaData.company?.members || []).slice(0, 5).map((m: any) => ({
          name: m.person?.name || '',
          role: m.role?.text || '',
          since: m.since || ''
        })),
        equity: cnpjaData.company?.equity || 0,
        status: cnpjaData.status?.text || '',
        simples: cnpjaData.company?.simples?.optant || false,
        address: cnpjaData.address
      } : { name: company },
      analysis,
      source: cnpjaData ? 'CNPJ.já + IA' : 'IA'
    })
  } catch (err) {
    console.error('analyze-company error:', err)
    return NextResponse.json({ error: 'Erro ao analisar empresa' }, { status: 500 })
  }
}
