import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const {
    platform = 'linkedin',
    topic = '',
    style = 'professional',
    customPrompt = '',
  } = await req.json();

  const platformLabel = platform === 'linkedin' ? 'LinkedIn' : 'Instagram';
  const topicLabel = topic || 'TMS — sistema de gestão de transporte';

  const toneMap: Record<string, string> = {
    professional: 'profissional, direto e confiante — linguagem de especialista do setor',
    bold: 'impactante, urgente e persuasivo — desperta curiosidade e gera ação imediata',
    friendly: 'amigável, humano e próximo — como se estivesse conversando com um colega do setor',
  };
  const toneLabel = toneMap[style] || toneMap.professional;

  const linkedinInstructions = `
Você é um copywriter sênior especializado em marketing B2B para o setor de logística e tecnologia.
Escreva um post PRONTO PARA PUBLICAR no LinkedIn para a empresa getLOG/Lottustech, que vende TMS (sistema de gestão de transporte) para distribuidoras e atacadistas no Brasil.

REGRAS OBRIGATÓRIAS:
1. Comece com um GANCHO forte na primeira linha — uma frase que para o scroll (máx 12 palavras)
2. Use quebras de linha estratégicas para facilitar a leitura mobile
3. Inclua dados/números concretos quando possível (ex: "até 20% de redução de custo")
4. Adicione uma CTA clara no final (ex: "Comenta aqui", "Me manda uma mensagem", "Acessa o link na bio")
5. Termine com 5-8 hashtags estratégicas do setor
6. Tom: ${toneLabel}
7. Tamanho ideal: 150-250 palavras (sem contar hashtags)
8. NÃO use emojis em excesso — máximo 3-4 no post inteiro
9. Escreva em português brasileiro natural, sem parecer texto de IA

CONTEXTO DA EMPRESA:
- getLOG/Lottustech: empresa de tecnologia para logística
- Produto principal: TMS (Transportation Management System)
- Público: gestores de logística, TI e supply chain em distribuidoras/atacadistas
- Diferencial: integração com ERP, rastreamento em tempo real, redução de custos

TEMA DO POST: ${topicLabel}
${customPrompt ? `INSTRUÇÃO ADICIONAL: ${customPrompt}` : ''}

Retorne APENAS o texto do post, sem explicações, sem título, sem aspas. Pronto para copiar e colar.`;

  const instagramInstructions = `
Você é um copywriter sênior especializado em marketing B2B para o setor de logística e tecnologia.
Escreva uma legenda PRONTA PARA PUBLICAR no Instagram para a conta @get.tms da getLOG/Lottustech.

REGRAS OBRIGATÓRIAS:
1. Comece com uma frase de impacto (máx 10 palavras) — deve funcionar como preview antes do "ver mais"
2. Use emojis estrategicamente para estruturar o texto (✅ para listas, 📊 para dados, etc.)
3. Quebre o texto em parágrafos curtos (máx 3 linhas cada)
4. Inclua uma pergunta ou CTA engajadora no final
5. Termine com 10-15 hashtags relevantes do setor de logística
6. Tom: ${toneLabel}
7. Tamanho: 100-180 palavras (sem contar hashtags)
8. Escreva em português brasileiro natural

CONTEXTO DA EMPRESA:
- getLOG/Lottustech: empresa de tecnologia para logística
- Produto: TMS (Transportation Management System)
- Público: gestores de logística, distribuidoras e atacadistas
- Perfil: @get.tms

TEMA DO POST: ${topicLabel}
${customPrompt ? `INSTRUÇÃO ADICIONAL: ${customPrompt}` : ''}

Retorne APENAS o texto da legenda, sem explicações, sem título, sem aspas. Pronto para copiar e colar.`;

  const systemPrompt = `Você é um copywriter sênior B2B especializado em logística e tecnologia. Escreve posts de alta conversão para redes sociais. Seu texto parece escrito por um humano experiente do setor, nunca por uma IA.`;

  const userPrompt = platform === 'linkedin' ? linkedinInstructions : instagramInstructions;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key não configurada' }, { status: 400 });
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.manus.im/api/llm-proxy/v1';

    // Tentar com gemini-2.5-flash primeiro
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
        temperature: 0.85,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      // Fallback com gpt-4.1-mini
      const fallback = await fetch(`${baseUrl}/chat/completions`, {
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
          temperature: 0.85,
          max_tokens: 600,
        }),
      });

      if (!fallback.ok) {
        return NextResponse.json({ error: 'Erro na IA' }, { status: 500 });
      }

      const fallbackData = await fallback.json();
      const text = fallbackData.choices?.[0]?.message?.content?.trim() || '';
      return NextResponse.json({ caption: text, platform, topic });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return NextResponse.json({ caption: text, platform, topic });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro na IA' }, { status: 500 });
  }
}
