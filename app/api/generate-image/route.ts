import { NextRequest, NextResponse } from 'next/server';

// Banco de imagens temáticas de logística/TMS do Unsplash — organizadas por tema
const IMAGES_BY_TOPIC: Record<string, { linkedin: string[]; instagram: string[] }> = {
  tms: {
    linkedin: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  tracking: {
    linkedin: [
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  innovation: {
    linkedin: [
      'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  cost: {
    linkedin: [
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  success: {
    linkedin: [
      'https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  integration: {
    linkedin: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  expansion: {
    linkedin: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
  default: {
    linkedin: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1200&h=627&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=1200&h=627&fit=crop&auto=format&q=85',
    ],
    instagram: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1080&h=1080&fit=crop&auto=format&q=85',
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1080&h=1080&fit=crop&auto=format&q=85',
    ],
  },
};

function getTopicKey(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes('tms') || t.includes('transport') || t.includes('gestão')) return 'tms';
  if (t.includes('track') || t.includes('rastr') || t.includes('cargo') || t.includes('carga')) return 'tracking';
  if (t.includes('innov') || t.includes('inova') || t.includes('digital') || t.includes('transform')) return 'innovation';
  if (t.includes('cost') || t.includes('custo') || t.includes('redu') || t.includes('efici')) return 'cost';
  if (t.includes('success') || t.includes('sucesso') || t.includes('case') || t.includes('result')) return 'success';
  if (t.includes('integr') || t.includes('erp') || t.includes('system')) return 'integration';
  if (t.includes('expan') || t.includes('prospec') || t.includes('comerci') || t.includes('b2b')) return 'expansion';
  return 'default';
}

export async function POST(req: NextRequest) {
  try {
    const { style = 'professional', platform = 'linkedin', topic = '' } = await req.json();

    const topicKey = getTopicKey(topic);
    const bank = IMAGES_BY_TOPIC[topicKey] || IMAGES_BY_TOPIC.default;
    const images = platform === 'instagram' ? bank.instagram : bank.linkedin;

    // Selecionar imagem aleatória do banco temático
    const idx = Math.floor(Math.random() * images.length);
    const imageUrl = images[idx];

    // Verificar se a imagem está acessível
    try {
      const check = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (check.ok) {
        return NextResponse.json({ url: imageUrl, provider: 'unsplash', topic: topicKey });
      }
    } catch {
      // fallback abaixo
    }

    // Fallback: imagem padrão de logística
    const fallback = IMAGES_BY_TOPIC.default[platform === 'instagram' ? 'instagram' : 'linkedin'][0];
    return NextResponse.json({ url: fallback, provider: 'unsplash', topic: 'default' });

  } catch (e: any) {
    console.error('generate-image error:', e);
    return NextResponse.json({
      url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=627&fit=crop&auto=format&q=85',
      provider: 'unsplash',
      error: e.message,
    });
  }
}
