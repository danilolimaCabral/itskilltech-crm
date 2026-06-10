import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, style = 'professional', platform = 'linkedin', topic } = await req.json();

    // Montar prompt otimizado para posts B2B
    const platformSpec = platform === 'linkedin'
      ? 'professional LinkedIn business post, wide format, corporate style'
      : 'Instagram square post, modern business style, vibrant';

    const styleGuide = style === 'professional'
      ? 'clean corporate design, blue and white color scheme, modern minimalist layout, professional business'
      : style === 'bold'
      ? 'bold colors, strong visual impact, high contrast, dynamic composition'
      : 'warm colors, friendly approachable design, soft gradients, welcoming';

    const fullPrompt = prompt
      ? `${prompt}, ${platformSpec}, ${styleGuide}, no text, high quality`
      : `Professional B2B technology logistics TMS software concept, ${topic ? topic + ', ' : ''}trucks and technology, digital transformation, ${platformSpec}, ${styleGuide}, no text overlays, photorealistic high quality`;

    // Usar Pollinations.ai — API gratuita e sem chave
    const width = platform === 'linkedin' ? 1200 : 1080;
    const height = platform === 'linkedin' ? 627 : 1080;
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const seed = Math.floor(Math.random() * 999999);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;

    // Verificar se a URL é acessível (Pollinations retorna imagem diretamente)
    const checkRes = await fetch(imageUrl, { method: 'HEAD' });
    if (!checkRes.ok) {
      // Tentar sem parâmetros extras
      const simpleUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
      return NextResponse.json({ url: simpleUrl, provider: 'pollinations' });
    }

    return NextResponse.json({
      url: imageUrl,
      provider: 'pollinations',
      prompt: fullPrompt
    });

  } catch (e: any) {
    console.error('generate-image error:', e);
    // Retornar URL de fallback mesmo em caso de erro
    const fallbackPrompt = encodeURIComponent('professional logistics technology business concept, trucks and digital systems, blue corporate style, no text');
    return NextResponse.json({
      url: `https://image.pollinations.ai/prompt/${fallbackPrompt}?width=1200&height=627&nologo=true`,
      provider: 'pollinations',
      error: e.message
    });
  }
}
