import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const { type, tone, objective, product, audience, count = 3 } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const isEmail = type === 'email';
  const toneLabel = tone || 'profissional e direto';
  const objectiveLabel = objective || 'apresentar solução de TMS logístico';
  const productLabel = product || 'ITskillTech TMS — sistema de gestão de transporte';
  const audienceLabel = audience || 'decisores de logística e TI em empresas atacadistas';

  const systemPrompt = isEmail
    ? `Você é um especialista em copywriting B2B para vendas de software. Crie templates de e-mail de prospecção frios (cold email) em português brasileiro.`
    : `Você é um especialista em copywriting B2B para vendas de software. Crie templates de mensagem de WhatsApp para prospecção fria (cold outreach) em português brasileiro. As mensagens devem ser curtas (máx 3 parágrafos), conversacionais e com CTA claro.`;

  const userPrompt = isEmail
    ? `Crie ${count} templates DIFERENTES de cold email B2B com as seguintes características:
- Tom: ${toneLabel}
- Objetivo: ${objectiveLabel}
- Produto/Serviço: ${productLabel}
- Público-alvo: ${audienceLabel}
- Cada template deve ter: NOME (título curto), ASSUNTO (subject line), CORPO (body completo)
- Use variáveis como {{nome}}, {{empresa}}, {{cargo}} para personalização
- Formatos variados: um mais curto (3 linhas), um com storytelling, um com prova social/dados
- Retorne em JSON: [{"name": "...", "subject": "...", "body": "..."}]`
    : `Crie ${count} templates DIFERENTES de mensagem de WhatsApp B2B com as seguintes características:
- Tom: ${toneLabel}
- Objetivo: ${objectiveLabel}
- Produto/Serviço: ${productLabel}
- Público-alvo: ${audienceLabel}
- Cada template deve ter: NOME (título curto), CORPO (mensagem completa, máx 150 palavras)
- Use variáveis como {{nome}}, {{empresa}}, {{cargo}} para personalização
- Formatos variados: um direto/objetivo, um com curiosidade/gancho, um com prova social
- Retorne em JSON: [{"name": "...", "body": "..."}]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0].message.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Erro ao parsear resposta da IA' }, { status: 500 });
    }

    // Normalizar: pode vir como { templates: [...] } ou diretamente como [...]
    const templates = Array.isArray(parsed) ? parsed : (parsed.templates || parsed.emails || parsed.messages || Object.values(parsed)[0] || []);

    return NextResponse.json({ templates, type });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro na IA' }, { status: 500 });
  }
}
