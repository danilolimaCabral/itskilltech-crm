import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { type, tone, objective, product, audience, workspace, workspaceName, count = 3 } = await req.json();

  const isEmail = type === 'email';
  const toneLabel = tone || 'profissional e direto';
  const objectiveLabel = objective || 'apresentar solução de TMS logístico';
  const productLabel = product || 'TMS — sistema de gestão de transporte';
  const audienceLabel = audience || 'decisores de logística e TI em empresas atacadistas';
  const workspaceLabel = workspaceName || workspace || 'getLOG/Lottustech';

  const systemPrompt = isEmail
    ? `Você é um especialista em copywriting B2B para vendas de software. Crie templates de e-mail de prospecção frios (cold email) em português brasileiro para a empresa ${workspaceLabel}.`
    : `Você é um especialista em copywriting B2B para vendas de software. Crie templates de mensagem de WhatsApp para prospecção fria (cold outreach) em português brasileiro para a empresa ${workspaceLabel}. As mensagens devem ser curtas (máx 3 parágrafos), conversacionais e com CTA claro.`;

  const userPrompt = isEmail
    ? `Crie ${count} templates DIFERENTES de cold email B2B com as seguintes características:
- Tom: ${toneLabel}
- Objetivo: ${objectiveLabel}
- Produto/Serviço: ${productLabel}
- Público-alvo: ${audienceLabel}
- Empresa remetente: ${workspaceLabel}
- Cada template deve ter: NOME (título curto), ASSUNTO (subject line), CORPO (body completo)
- Use variáveis como {{nome}}, {{empresa}}, {{cargo}} para personalização
- Formatos variados: um mais curto (3 linhas), um com storytelling, um com prova social/dados
- Retorne APENAS JSON válido no formato: {"templates": [{"name": "...", "subject": "...", "body": "..."}]}`
    : `Crie ${count} templates DIFERENTES de mensagem de WhatsApp B2B com as seguintes características:
- Tom: ${toneLabel}
- Objetivo: ${objectiveLabel}
- Produto/Serviço: ${productLabel}
- Público-alvo: ${audienceLabel}
- Empresa remetente: ${workspaceLabel}
- Cada template deve ter: NOME (título curto), CORPO (mensagem completa, máx 150 palavras)
- Use variáveis como {{nome}}, {{empresa}}, {{cargo}} para personalização
- Formatos variados: um direto/objetivo, um com curiosidade/gancho, um com prova social
- Retorne APENAS JSON válido no formato: {"templates": [{"name": "...", "body": "..."}]}`;

  try {
    // Usar Gemini via API compatível com OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key não configurada' }, { status: 400 });
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.manus.im/api/llm-proxy/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      // Fallback: tentar com gpt-4.1-mini
      const fallbackResp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
        }),
      });
      if (!fallbackResp.ok) {
        return NextResponse.json({ error: `Erro na IA: ${errText}` }, { status: 500 });
      }
      const fallbackData = await fallbackResp.json();
      const raw = fallbackData.choices?.[0]?.message?.content || '{}';
      return parseAndReturn(raw, type);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    return parseAndReturn(raw, type);

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro na IA' }, { status: 500 });
  }
}

function parseAndReturn(raw: string, type: string) {
  // Remover markdown code blocks se existirem
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Tentar extrair JSON do texto
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return NextResponse.json({ error: 'Erro ao parsear resposta da IA' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Resposta da IA não é JSON válido' }, { status: 500 });
    }
  }

  // Normalizar: pode vir como { templates: [...] } ou diretamente como [...]
  const templates = Array.isArray(parsed)
    ? parsed
    : (parsed.templates || parsed.emails || parsed.messages || Object.values(parsed)[0] || []);

  return NextResponse.json({ templates, type });
}
