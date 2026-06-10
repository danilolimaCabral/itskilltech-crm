'use client';
import { useState } from 'react';

const TOPICS = [
  { label: '🚚 TMS / Gestão de Transporte', value: 'TMS logistics management software for Brazilian companies' },
  { label: '📦 Rastreamento de Cargas', value: 'cargo tracking and visibility solutions for logistics' },
  { label: '💡 Inovação em Logística', value: 'innovation and digital transformation in logistics and supply chain' },
  { label: '📊 Redução de Custos', value: 'cost reduction and efficiency in transportation management' },
  { label: '🤝 Case de Sucesso', value: 'success story of a company that improved logistics with technology' },
  { label: '🔗 Integração de Sistemas', value: 'ERP and TMS integration for logistics automation' },
  { label: '🌎 Expansão Comercial', value: 'B2B commercial expansion and prospecting in logistics sector' },
];

const STYLES = [
  { label: '🏢 Profissional', value: 'professional' },
  { label: '⚡ Impactante', value: 'bold' },
  { label: '😊 Amigável', value: 'friendly' },
];

const PLATFORMS = [
  { label: '💼 LinkedIn', value: 'linkedin' },
  { label: '📸 Instagram', value: 'instagram' },
];

const CAPTION_TEMPLATES = [
  {
    label: '🎯 Prospecção Direta',
    text: `Você sabia que empresas que implementam um TMS reduzem seus custos logísticos em até 20%?\n\nNa getLOG/Lottustech, ajudamos distribuidoras e atacadistas a:\n✅ Rastrear cargas em tempo real\n✅ Integrar com seu ERP atual\n✅ Reduzir devoluções e retrabalho\n\nQuer saber como? Fale comigo! 👇\n\n#TMS #Logística #GestãoDeTransporte #Tecnologia #B2B`,
  },
  {
    label: '📊 Dados e Resultados',
    text: `📊 Resultado real de um dos nossos clientes:\n\n→ 18% de redução no custo de frete\n→ 95% de entregas no prazo\n→ Integração com ERP em 30 dias\n\nIsso é o que um TMS bem implementado faz pela sua operação.\n\nVamos conversar sobre a sua? 🚀\n\n#Logística #TMS #ResultadosReais #Distribuição`,
  },
  {
    label: '💡 Dica de Valor',
    text: `💡 Dica para gestores de logística:\n\nSe você ainda controla fretes por planilha, está deixando dinheiro na mesa.\n\nUm TMS moderno te dá:\n📍 Visibilidade total da frota\n📋 Documentação automática\n💰 Negociação com transportadoras baseada em dados\n\nNa getLOG, a gente transforma isso em realidade. Bora conversar?\n\n#Logística #TMS #Inovação`,
  },
];

export default function SocialPage() {
  const [platform, setPlatform] = useState('linkedin');
  const [topic, setTopic] = useState(TOPICS[0].value);
  const [style, setStyle] = useState('professional');
  const [customPrompt, setCustomPrompt] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImage, setUploadedImage] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'create'|'schedule'>('create');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const generateImage = async () => {
    setGeneratingImage(true);
    setImageUrl('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, style, platform, prompt: customPrompt || undefined }),
      });
      const data = await res.json();
      if (data.url) {
        setImageUrl(data.url);
        showToast('✅ Imagem gerada com sucesso!');
      } else {
        showToast('⚠️ ' + (data.error || 'Erro ao gerar imagem. Faça upload de uma imagem.'));
      }
    } catch {
      showToast('❌ Erro ao gerar imagem');
    }
    setGeneratingImage(false);
  };

  const generateCaption = async () => {
    setGeneratingCaption(true);
    try {
      const res = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'linkedin_post',
          tone: style === 'professional' ? 'profissional e direto' : style === 'bold' ? 'impactante e persuasivo' : 'amigável e acessível',
          objective: `criar post para ${platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} sobre ${TOPICS.find(t => t.value === topic)?.label || topic}`,
          product: 'TMS — sistema de gestão de transporte da getLOG/Lottustech',
          audience: 'decisores de logística, TI e supply chain em empresas atacadistas e distribuidoras',
          workspace: 'getLOG/Lottustech',
          workspaceName: 'getLOG/Lottustech',
          count: 1,
          platform,
        }),
      });
      const data = await res.json();
      // Tentar extrair o texto do post
      if (data.templates?.[0]?.body) {
        setCaption(data.templates[0].body);
        showToast('✅ Legenda gerada!');
      } else if (typeof data === 'string') {
        setCaption(data);
        showToast('✅ Legenda gerada!');
      } else {
        // Usar template padrão
        setCaption(CAPTION_TEMPLATES[0].text);
        showToast('✅ Template aplicado!');
      }
    } catch {
      setCaption(CAPTION_TEMPLATES[0].text);
      showToast('⚠️ Usando template padrão');
    }
    setGeneratingCaption(false);
  };

  const postToInstagram = async () => {
    if (!caption.trim()) { showToast('⚠️ Adicione uma legenda antes de publicar'); return; }
    const finalImage = uploadedImage || imageUrl;
    if (!finalImage) { showToast('⚠️ Adicione ou gere uma imagem antes de publicar'); return; }
    setPosting(true);
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, imageUrl: finalImage }),
      });
      const data = await res.json();
      if (data.success || data.id) {
        showToast('✅ Post publicado no Instagram @get.tms!');
        setCaption(''); setImageUrl(''); setUploadedImage('');
      } else {
        showToast('❌ Erro: ' + (data.error || 'Falha ao publicar'));
      }
    } catch {
      showToast('❌ Erro ao publicar no Instagram');
    }
    setPosting(false);
  };

  const openLinkedIn = () => {
    const text = encodeURIComponent(caption);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://gettms.com.br&summary=${text}`, '_blank');
    showToast('✅ LinkedIn aberto para publicação!');
  };

  const finalImage = uploadedImage || imageUrl;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', padding: '24px 16px' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#1e293b', color: '#fff', borderRadius: 10, padding: '12px 20px', zIndex: 9999, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>← CRM</a>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ fontWeight: 700, fontSize: 18 }}>📣 Social Media</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 10, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {[{key:'create',label:'✏️ Criar Post'},{key:'schedule',label:'📅 Agendados'}].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ background: tab === t.key ? '#0066ff' : 'transparent', color: tab === t.key ? '#fff' : '#64748b', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400, fontSize: 13, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Coluna esquerda: configurações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Plataforma */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>📲 Plataforma</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PLATFORMS.map(p => (
                    <button key={p.value} onClick={() => setPlatform(p.value)}
                      style={{ flex: 1, background: platform === p.value ? (p.value === 'linkedin' ? '#0a66c2' : '#e1306c') : '#f1f5f9', color: platform === p.value ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tema */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🎯 Tema do Post</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {TOPICS.map(t => (
                    <button key={t.value} onClick={() => setTopic(t.value)}
                      style={{ background: topic === t.value ? '#eff6ff' : '#f8fafc', color: topic === t.value ? '#1d4ed8' : '#374151', border: `1px solid ${topic === t.value ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, textAlign: 'left', fontWeight: topic === t.value ? 600 : 400 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estilo */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🎨 Estilo Visual</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STYLES.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      style={{ flex: 1, background: style === s.value ? '#0066ff' : '#f1f5f9', color: style === s.value ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 12, fontWeight: style === s.value ? 600 : 400 }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt customizado */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>✏️ Descrição da Imagem (opcional)</div>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="Ex: Caminhão moderno numa rodovia ao entardecer, cores azul e laranja..."
                  rows={3}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Coluna direita: preview e ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Imagem */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🖼️ Imagem do Post</div>

                {/* Preview da imagem */}
                <div style={{ width: '100%', aspectRatio: platform === 'linkedin' ? '16/9' : '1/1', background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #e2e8f0' }}>
                  {finalImage ? (
                    <img src={finalImage} alt="Post preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ fontSize: 40 }}>🖼️</div>
                      <div style={{ fontSize: 12, marginTop: 8 }}>Gere ou faça upload de uma imagem</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={generateImage} disabled={generatingImage}
                    style={{ flex: 1, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', cursor: generatingImage ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, opacity: generatingImage ? 0.7 : 1 }}>
                    {generatingImage ? '⏳ Gerando...' : '🤖 Gerar com IA'}
                  </button>
                  <label style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontWeight: 600, fontSize: 13, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    📁 Upload
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => setUploadedImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                </div>
                {finalImage && (
                  <button onClick={() => { setImageUrl(''); setUploadedImage(''); }}
                    style={{ width: '100%', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '6px 0', cursor: 'pointer', fontSize: 12, marginTop: 6 }}>
                    🗑️ Remover imagem
                  </button>
                )}
              </div>

              {/* Legenda */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>📝 Legenda</div>
                  <button onClick={generateCaption} disabled={generatingCaption}
                    style={{ background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: generatingCaption ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                    {generatingCaption ? '⏳ Gerando...' : '🤖 Gerar com IA'}
                  </button>
                </div>

                {/* Templates rápidos */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {CAPTION_TEMPLATES.map((t, i) => (
                    <button key={i} onClick={() => setCaption(t.text)}
                      style={{ background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Escreva a legenda do post ou gere com IA..."
                  rows={8}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>{caption.length} caracteres</div>
              </div>

              {/* Botões de publicação */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🚀 Publicar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={openLinkedIn}
                    style={{ width: '100%', background: '#0a66c2', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    💼 Publicar no LinkedIn
                  </button>
                  <button onClick={postToInstagram} disabled={posting}
                    style={{ width: '100%', background: 'linear-gradient(135deg, #e1306c, #833ab4)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', cursor: posting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: posting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {posting ? '⏳ Publicando...' : '📸 Publicar no Instagram @get.tms'}
                  </button>
                  <button onClick={() => {
                    const text = `${caption}\n\n${finalImage ? `[Imagem: ${finalImage}]` : ''}`;
                    navigator.clipboard.writeText(text);
                    showToast('✅ Copiado para a área de transferência!');
                  }}
                    style={{ width: '100%', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    📋 Copiar Legenda
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'schedule' && (
          <div style={{ background: '#fff', borderRadius: 14, padding: 40, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: '#374151' }}>Agendamento de Posts</div>
            <div style={{ fontSize: 14 }}>Em breve: agende posts para LinkedIn e Instagram com antecedência.</div>
          </div>
        )}
      </div>
    </div>
  );
}
