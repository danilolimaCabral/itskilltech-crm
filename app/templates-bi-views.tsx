'use client';
import { useState, useEffect } from 'react';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

const ICONS: any = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  sparkles: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/>',
};

// ---------- Templates ----------
export function TemplatesView({ workspace, workspaceName, templates, onReload, showToast }: any) {
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [editing, setEditing] = useState<any | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [aiTone, setAiTone] = useState('profissional');
  const [aiContext, setAiContext] = useState('');

  const filtered = templates.filter((t: any) => t.type === tab);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tab, tone: aiTone, context: aiContext, workspace, workspaceName, count: 3 }),
      });
      const j = await r.json();
      if (j.error) {
        showToast('Erro ao gerar: ' + j.error);
      } else if (j.templates && Array.isArray(j.templates) && j.templates.length > 0) {
        // Salvar todos os templates gerados automaticamente
        let saved = 0;
        for (const tpl of j.templates) {
          try {
            await fetch('/api/templates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...tpl, id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, workspace, type: tab }),
            });
            saved++;
          } catch {}
        }
        showToast(`✓ ${saved} template(s) gerado(s) e salvo(s)!`);
        onReload();
      } else if (j.template) {
        // Compatibilidade com resposta singular
        setEditing({ ...j.template, id: '', workspace, type: tab });
        showToast('Template gerado pela IA!');
      } else {
        showToast('Erro: resposta inválida da IA. Tente novamente.');
      }
    } catch (e: any) {
      showToast('Erro ao gerar template: ' + (e?.message || 'falha na conexão'));
    }
    setGenerating(false);
  };

  const save = async () => {
    if (!editing?.name || !editing?.body) { showToast('Nome e corpo sao obrigatorios'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editing, workspace, type: tab }),
      });
      if (r.ok) { showToast('Template salvo!'); setEditing(null); onReload(); }
      else { const j = await r.json(); showToast('Erro ao salvar: ' + (j.error || 'falha')); }
    } catch { showToast('Erro ao salvar template'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      showToast('Template excluido'); onReload();
    } catch { showToast('Erro ao excluir'); }
    setDeleting(null);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Templates</div>
          <div className="page-description">Mensagens por workspace — use nome, empresa, cargo como variaveis</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ name: '', body: '', subject: '', type: tab, workspace, id: '' })}>
          <Icon d={ICONS.plus} />Novo template
        </button>
      </div>

      <div className="filter-group" style={{ marginBottom: 16 }}>
        <button className={`filter-tab${tab === 'whatsapp' ? ' active' : ''}`} onClick={() => setTab('whatsapp')}>WhatsApp</button>
        <button className={`filter-tab${tab === 'email' ? ' active' : ''}`} onClick={() => setTab('email')}>E-mail</button>
      </div>

      <div className="table-wrap" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Gerar com IA</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="field">
            <label className="field-label">Tom da mensagem</label>
            <select className="field-select" value={aiTone} onChange={e => setAiTone(e.target.value)}>
              <option value="profissional">Profissional</option>
              <option value="descontraido">Descontraido</option>
              <option value="urgente">Urgente / Direto</option>
              <option value="consultivo">Consultivo</option>
              <option value="follow-up">Follow-up</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Contexto (opcional)</label>
            <input className="field-input" value={aiContext} onChange={e => setAiContext(e.target.value)} placeholder="Ex: TMS para atacadistas, Sul do Brasil..." />
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating} style={{ width: '100%', justifyContent: 'center' }}>
          <Icon d={ICONS.sparkles} />{generating ? 'Gerando...' : `Gerar template de ${tab === 'whatsapp' ? 'WhatsApp' : 'e-mail'} com IA`}
        </button>
      </div>

      {filtered.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhum template criado ainda. Gere um com IA ou clique em Novo template.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((t: any) => (
          <div key={t.id} className="table-wrap" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                {t.subject && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Assunto: {t.subject}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-sm" onClick={() => setEditing({ ...t })}><Icon d={ICONS.edit} /></button>
                <button className="btn btn-danger btn-sm" disabled={deleting === t.id} onClick={() => remove(t.id)}><Icon d={ICONS.trash} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-2, #f9fafb)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>
              {t.body}
            </div>
            <button className="btn btn-sm" style={{ marginTop: 8, fontSize: 11 }} onClick={() => { navigator.clipboard?.writeText(t.body); showToast('Copiado!'); }}>
              <Icon d={ICONS.copy} />Copiar
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">{editing.id ? 'Editar template' : 'Novo template'}</div>
              <button className="modal-close" onClick={() => setEditing(null)}>x</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">Nome do template *</label>
                <input className="field-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Primeiro contato TMS" />
              </div>
              {tab === 'email' && (
                <div className="field">
                  <label className="field-label">Assunto do e-mail</label>
                  <input className="field-input" value={editing.subject || ''} onChange={e => setEditing({ ...editing, subject: e.target.value })} placeholder="Ex: Solucao TMS para sua empresa" />
                </div>
              )}
              <div className="field">
                <label className="field-label">Mensagem * (use {'{{'+'nome'+'}}'}, {'{{'+'empresa'+'}}'}, {'{{'+'cargo'+'}}'} como variáveis)</label>
                <textarea className="field-textarea" style={{ minHeight: 220 }} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} />
              </div>
              {tab === 'email' && (
                <div className="field">
                  <label className="field-label">📎 Anexo / Apresentação (URL pública)</label>
                  <input className="field-input" value={editing.attachment_url || ''} onChange={e => setEditing({ ...editing, attachment_url: e.target.value })} placeholder="https://drive.google.com/... ou https://..." />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Cole o link direto do arquivo (PDF, imagem). Use Google Drive com acesso público ou Dropbox.</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar template'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- BI / Dashboard ----------
export function BIView({ workspace, leads }: any) {
  const [callStats, setCallStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/stats?workspace=${workspace}`);
        const j = await r.json();
        setCallStats(j);
      } catch { setCallStats(null); }
      setLoading(false);
    })();
  }, [workspace]);

  const total = leads.length;
  const novos = leads.filter((l: any) => l.status === 'novo').length;
  const contatados = leads.filter((l: any) => l.status === 'contatado').length;
  const negociacao = leads.filter((l: any) => l.status === 'negociacao').length;
  const fechados = leads.filter((l: any) => l.status === 'fechado').length;
  const perdidos = leads.filter((l: any) => l.status === 'perdido').length;

  const convRate = total > 0 ? ((fechados / total) * 100).toFixed(1) : '0.0';
  const contactRate = total > 0 ? (((total - novos) / total) * 100).toFixed(1) : '0.0';

  const funnelSteps = [
    { label: 'Total de leads', value: total, color: '#0066ff', pct: 100 },
    { label: 'Contatados', value: total - novos, color: '#6938ef', pct: total > 0 ? Math.round(((total - novos) / total) * 100) : 0 },
    { label: 'Em negociacao', value: negociacao, color: '#f79009', pct: total > 0 ? Math.round((negociacao / total) * 100) : 0 },
    { label: 'Fechados', value: fechados, color: '#079455', pct: total > 0 ? Math.round((fechados / total) * 100) : 0 },
  ];

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">BI / Prospeccao</div><div className="page-description">Metricas e funil de vendas deste workspace</div></div>
      </div>

      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-value">{total}</div><div className="stat-label">Total de leads</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#0066ff' }}>{novos}</div><div className="stat-label">Novos</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#079455' }}>{fechados}</div><div className="stat-label">Fechados</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#f79009' }}>{negociacao}</div><div className="stat-label">Em negociacao</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="table-wrap" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#079455' }}>{convRate}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Taxa de conversao</div>
        </div>
        <div className="table-wrap" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#6938ef' }}>{contactRate}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Taxa de contato</div>
        </div>
      </div>

      <div className="table-wrap" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Funil de Vendas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {funnelSteps.map((step, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{step.label}</span>
                <span style={{ fontWeight: 600 }}>{step.value} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({step.pct}%)</span></span>
              </div>
              <div style={{ height: 10, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${step.pct}%`, background: step.color, borderRadius: 6, transition: 'width .6s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="table-wrap" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Distribuicao por Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Novo', value: novos, color: '#0066ff' },
            { label: 'Contatado', value: contatados, color: '#6938ef' },
            { label: 'Em negociacao', value: negociacao, color: '#f79009' },
            { label: 'Fechado', value: fechados, color: '#079455' },
            { label: 'Perdido', value: perdidos, color: '#d92d20' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{s.label}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{s.value}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Carregando metricas de ligacoes...</div>
      ) : callStats ? (
        <div className="table-wrap" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Metricas de Ligacoes</div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-value">{callStats.total_calls || 0}</div><div className="stat-label">Total de ligacoes</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#079455' }}>{callStats.answered || 0}</div><div className="stat-label">Atendidas</div></div>
            <div className="stat-card"><div className="stat-value" style={{ color: '#f79009' }}>{callStats.interested || 0}</div><div className="stat-label">Com interesse</div></div>
          </div>
          {callStats.total_calls > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Atendeu com interesse', value: callStats.atendeu_interesse || 0, color: '#079455' },
                { label: 'Atendeu sem interesse', value: callStats.atendeu_sem_interesse || 0, color: '#f79009' },
                { label: 'Nao atendeu', value: callStats.nao_atendeu || 0, color: '#667085' },
                { label: 'Caixa postal', value: callStats.caixa_postal || 0, color: '#98a2b3' },
                { label: 'Numero errado', value: callStats.numero_errado || 0, color: '#d92d20' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                    {callStats.total_calls > 0 ? Math.round((s.value / callStats.total_calls) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Mapa do Brasil por estado */}
      <MapaBrasil leads={leads} />
    </>
  );
}

function MapaBrasil({ leads }: { leads: any[] }) {
  const estadoCount: Record<string, number> = {};
  leads.forEach((l: any) => {
    // Tenta extrair UF do campo notes ("Cidade: X/UF") ou do campo state
    const notesMatch = l.notes?.match(/Cidade:\s*[^/\n]+\/([A-Z]{2})/i);
    const uf = (notesMatch?.[1] || l.state || '').toUpperCase().trim();
    if (uf && uf.length === 2) estadoCount[uf] = (estadoCount[uf] || 0) + 1;
  });
  const maxCount = Math.max(...Object.values(estadoCount), 1);
  const [hoveredUF, setHoveredUF] = useState<string | null>(null);

  // Posicoes aproximadas dos estados no SVG 500x560
  const statePos: Record<string, [number, number, string]> = {
    AC: [62, 308, 'Acre'], AM: [132, 238, 'Amazonas'], RR: [178, 128, 'Roraima'],
    PA: [272, 198, 'Pará'], AP: [312, 128, 'Amapá'], TO: [312, 288, 'Tocantins'],
    MA: [352, 198, 'Maranhão'], PI: [392, 228, 'Piauí'], CE: [422, 192, 'Ceará'],
    RN: [452, 192, 'R.G.Norte'], PB: [452, 212, 'Paraíba'], PE: [438, 232, 'Pernambuco'],
    AL: [452, 252, 'Alagoas'], SE: [452, 268, 'Sergipe'], BA: [402, 292, 'Bahia'],
    MG: [362, 352, 'Minas Gerais'], ES: [412, 352, 'Espírito Santo'],
    RJ: [392, 382, 'Rio de Janeiro'], SP: [342, 388, 'São Paulo'],
    PR: [312, 428, 'Paraná'], SC: [312, 458, 'Santa Catarina'],
    RS: [292, 492, 'Rio Grande do Sul'], MS: [282, 378, 'Mato Grosso do Sul'],
    MT: [232, 308, 'Mato Grosso'], GO: [302, 328, 'Goiás'],
    DF: [322, 338, 'Distrito Federal'], RO: [158, 318, 'Rondônia'],
  };

  const getColor = (uf: string) => {
    const count = estadoCount[uf] || 0;
    if (count === 0) return '#e5e7eb';
    const t = count / maxCount;
    return `rgb(${Math.round(99 - t * 50)},${Math.round(102 - t * 60)},${Math.round(241 - t * 40)})`;
  };

  const topStates = Object.entries(estadoCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalMapped = Object.values(estadoCount).reduce((a, b) => a + b, 0);

  return (
    <div className="table-wrap" style={{ padding: 16, marginTop: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Distribuição Geográfica de Leads</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Mapa SVG */}
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <svg viewBox="0 0 500 560" style={{ width: '100%', maxWidth: 320 }}>
            {Object.entries(statePos).map(([uf, [cx, cy, nome]]) => {
              const count = estadoCount[uf] || 0;
              const r = count > 0 ? Math.max(14, Math.min(26, 14 + (count / maxCount) * 12)) : 13;
              const isHov = hoveredUF === uf;
              return (
                <g key={uf} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredUF(uf)}
                  onMouseLeave={() => setHoveredUF(null)}>
                  <circle cx={cx} cy={cy} r={r}
                    fill={getColor(uf)}
                    stroke={isHov ? '#6366f1' : '#fff'}
                    strokeWidth={isHov ? 2.5 : 1.5}
                    style={{ transition: 'all .15s' }}
                  />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 9, fontWeight: 700, fill: count > 0 ? '#fff' : '#9ca3af', pointerEvents: 'none', userSelect: 'none' }}>
                    {uf}
                  </text>
                  {count > 0 && (
                    <text x={cx} y={cy + 11} textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: 8, fill: '#fff', opacity: 0.9, pointerEvents: 'none', userSelect: 'none' }}>
                      {count}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hoveredUF && (
            <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,.12)', pointerEvents: 'none', zIndex: 10 }}>
              <div style={{ fontWeight: 700 }}>{statePos[hoveredUF]?.[2] || hoveredUF}</div>
              <div style={{ color: '#6366f1', fontWeight: 600 }}>{estadoCount[hoveredUF] || 0} lead(s)</div>
            </div>
          )}
        </div>

        {/* Ranking */}
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 }}>Top Estados</div>
          {topStates.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
              Nenhum estado identificado.<br/>O agente preenche automaticamente ao importar leads.
            </div>
          ) : (
            topStates.map(([uf, count], i) => (
              <div key={uf} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 12, flex: 1 }}>{statePos[uf]?.[2] || uf}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#6366f1', minWidth: 24, textAlign: 'right' }}>{count}</span>
                <div style={{ width: 50, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${Math.round((count / maxCount) * 100)}%`, background: '#6366f1', borderRadius: 3 }} />
                </div>
              </div>
            ))
          )}
          {totalMapped > 0 && (
            <div style={{ marginTop: 16, padding: '8px 10px', background: 'var(--surface-2, #f9fafb)', borderRadius: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{totalMapped} de {leads.length} leads mapeados</span>
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 60, height: 8, borderRadius: 4, background: 'linear-gradient(to right, #e5e7eb, #6366f1)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0 → {maxCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
