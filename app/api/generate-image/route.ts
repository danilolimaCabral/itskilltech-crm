import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, style = 'professional', platform = 'linkedin', topic } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key não configurada' }, { status: 500 });
    }

    // Montar prompt otimizado para posts B2B
    const platformSpec = platform === 'linkedin'
      ? 'LinkedIn post image, 1200x627px aspect ratio, professional business style'
      : 'Instagram post image, 1080x1080px square format, modern business style';

    const styleGuide = style === 'professional'
      ? 'clean corporate design, blue and white color scheme, modern typography, minimalist layout'
      : style === 'bold'
      ? 'bold colors, strong typography, high contrast, impactful visual'
      : 'warm colors, friendly tone, approachable design, soft gradients';

    const fullPrompt = prompt
      ? `${prompt}. ${platformSpec}. ${styleGuide}. No text overlays. High quality.`
      : `Professional B2B technology post about ${topic || 'logistics management software TMS'}. ${platformSpec}. ${styleGuide}. Abstract business concept visualization, no text. High quality photorealistic.`;

    // Tentar DALL-E 3 via API OpenAI direta
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size: platform === 'linkedin' ? '1792x1024' : '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('DALL-E error:', err);
      // Fallback: retornar imagem placeholder profissional
      return NextResponse.json({
        url: null,
        error: 'Geração de imagem não disponível. Use uma imagem própria.',
        fallback: true,
      });
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    return NextResponse.json({ url: imageUrl, revised_prompt: data.data?.[0]?.revised_prompt });
  } catch (e: any) {
    console.error('generate-image error:', e);
    return NextResponse.json({ error: e.message, fallback: true }, { status: 500 });
  }
}
