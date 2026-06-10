import { NextRequest, NextResponse } from 'next/server';

// Banco de imagens temáticas de logística/TMS do Unsplash (IDs fixos e funcionais)
const LOGISTICS_IMAGES = {
  linkedin: [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=627&fit=crop&auto=format', // caminhão logística
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&h=627&fit=crop&auto=format', // armazém
    'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&h=627&fit=crop&auto=format', // supply chain
    'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1200&h=627&fit=crop&auto=format', // caminhão estrada
    'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200&h=627&fit=crop&auto=format', // tecnologia logística
    'https://images.unsplash.com/photo-1565793979456-f5f5c4b9f9c3?w=1200&h=627&fit=crop&auto=format', // frota
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1200&h=627&fit=crop&auto=format', // container porto
    'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=1200&h=627&fit=crop&auto=format', // dashboard tech
  ],
  instagram: [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1080&h=1080&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1080&h=1080&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1080&h=1080&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1080&h=1080&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1080&h=1080&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1080&h=1080&fit=crop&auto=format',
  ]
};

// Mapear tópico para índice de imagem
function topicToIndex(topic: string): number {
  if (topic.includes('TMS') || topic.includes('transport')) return 0;
  if (topic.includes('track') || topic.includes('rastr')) return 1;
  if (topic.includes('supply') || topic.includes('chain')) return 2;
  if (topic.includes('cost') || topic.includes('custo')) return 3;
  if (topic.includes('tech') || topic.includes('digital')) return 4;
  if (topic.includes('integr')) return 5;
  if (topic.includes('expan') || topic.includes('prospec')) return 6;
  return Math.floor(Math.random() * 4);
}

export async function POST(req: NextRequest) {
  try {
    const { style = 'professional', platform = 'linkedin', topic = '' } = await req.json();

    const images = LOGISTICS_IMAGES[platform as 'linkedin' | 'instagram'] || LOGISTICS_IMAGES.linkedin;
    const idx = topicToIndex(topic);
    const imageUrl = images[idx % images.length];

    // Verificar se a imagem está acessível
    try {
      const check = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (check.ok) {
        return NextResponse.json({ url: imageUrl, provider: 'unsplash', prompt: topic });
      }
    } catch {
      // fallback abaixo
    }

    // Fallback: Picsum com seed baseado no tópico
    const seed = topic.replace(/\s+/g, '-').toLowerCase() || 'logistics';
    const w = platform === 'linkedin' ? 1200 : 1080;
    const h = platform === 'linkedin' ? 627 : 1080;
    const fallbackUrl = `https://picsum.photos/seed/${seed}/${w}/${h}`;

    return NextResponse.json({ url: fallbackUrl, provider: 'picsum', prompt: topic });

  } catch (e: any) {
    console.error('generate-image error:', e);
    return NextResponse.json({
      url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=627&fit=crop&auto=format',
      provider: 'unsplash',
      error: e.message
    });
  }
}
