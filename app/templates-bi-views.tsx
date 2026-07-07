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
    if (!confirm('Deseja realmente excluir este template?')) return;
    setDeleting(id);
    try {
      const r = await fetch('/api/templates', { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (r.ok) {
        showToast('Template excluído com sucesso!');
        onReload();
      } else {
        showToast('Erro ao excluir template');
      }
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
  const [activityStats, setActivityStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados da Calculadora de Custos
  const [sdrCost, setSdrCost] = useState<number>(3000);
  const [toolsCost, setToolsCost] = useState<number>(1000);
  const [leadsCost, setToolsDataCost] = useState<number>(500);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Buscar estatísticas de ligações
        const r = await fetch(`/api/stats?workspace=${workspace}`);
        const j = await r.json();
        setCallStats(j);
        
        // Buscar atividades de outbound em tempo real
        const rAct = await fetch(`/api/get-real-activities`);
        const jAct = await rAct.json();
        setActivityStats(jAct);
      } catch { 
        setCallStats(null); 
        setActivityStats(null);
      }
      setLoading(false);
    })();
  }, [workspace]);

  // --- 1. NORMALIZAÇÃO DE STATUS (FUNIL DO CRM) ---
  const totalLeads = leads.length;
  
  // Normalizar todos os leads para o funil atual de 6 etapas
  const LEGACY_MAP: any = { novo: 'prospeccao', contatado: 'qualificacao', interesse: 'interesse', negociacao: 'apresentacao', fechado: 'fechamento', perdido: 'perdido' };
  const getNormStatus = (l: any) => {
    const s = l.status;
    return ['prospeccao', 'email_enviado', 'qualificacao', 'email_aberto', 'interesse', 'apresentacao', 'proposta', 'fechamento', 'posvenda', 'perdido'].includes(s) ? s : (LEGACY_MAP[s] || 'prospeccao');
  };

  const sProspeccao = leads.filter((l: any) => getNormStatus(l) === 'prospeccao').length;
  const sEmailEnviado = leads.filter((l: any) => getNormStatus(l) === 'email_enviado').length;
  const sQualificacao = leads.filter((l: any) => getNormStatus(l) === 'qualificacao').length;
  const sEmailAberto = leads.filter((l: any) => getNormStatus(l) === 'email_aberto').length;
  const sInteresse = leads.filter((l: any) => getNormStatus(l) === 'interesse').length;
  const sApresentacao = leads.filter((l: any) => getNormStatus(l) === 'apresentacao').length;
  const sProposta = leads.filter((l: any) => getNormStatus(l) === 'proposta').length;
  const sFechamento = leads.filter((l: any) => getNormStatus(l) === 'fechamento').length;
  const sPosVenda = leads.filter((l: any) => getNormStatus(l) === 'posvenda').length;
  const sPerdido = leads.filter((l: any) => getNormStatus(l) === 'perdido').length;

  // --- 2. CÁLCULO DAS 7 MÉTRICAS DE OUTBOUND ---
  
  // Atividades reais do endpoint de timeline
  const summary = activityStats?.summary || {};
  let totalDials = 0; // Total de tentativas de ligação
  let totalConnected = 0; // Ligações que viraram conversa real (atendeu_interesse + atendeu_sem_interesse)
  let totalEmailsSent = 0; // E-mails enviados
  let totalEmailsOpened = 0; // E-mails abertos
  let totalWhatsSent = 0; // Mensagens de WhatsApp enviadas
  let totalLinkedinSent = 0; // Mensagens de LinkedIn enviadas

  // Somar atividades reais
  Object.values(summary).forEach((day: any) => {
    totalEmailsSent += day.email || 0;
    totalEmailsOpened += day.email_opened || 0;
    totalWhatsSent += day.whatsapp || 0;
    totalLinkedinSent += day.linkedin || 0;
  });

  // Pegar ligações do endpoint de stats
  if (callStats?.calls) {
    totalDials = callStats.calls.total || 0;
    totalConnected = (callStats.calls.atendeu_interesse || 0) + (callStats.calls.atendeu_sem_interesse || 0);
  }

  const totalOutboundTouches = totalDials + totalEmailsSent + totalWhatsSent + totalLinkedinSent;

  // Métricas do post:
  // 1. Taxa de Conexão: Contatos que viraram conversa real (totalConnected) ÷ total de contatos tentados (totalDials)
  const connectionRate = totalDials > 0 ? ((totalConnected / totalDials) * 100).toFixed(1) : '0.0';

  // 2. Taxa de Resposta: Respostas obtidas (WhatsApp/LinkedIn ou e-mails abertos) ÷ contatos enviados (e-mails + whats + linkedin)
  const totalSentTouches = totalEmailsSent + totalWhatsSent + totalLinkedinSent;
  const totalResponses = totalEmailsOpened + sInteresse; // E-mails abertos + leads que marcaram interesse
  const responseRate = totalSentTouches > 0 ? ((totalResponses / totalSentTouches) * 100).toFixed(1) : '0.0';

  // 3. MQL (Marketing Qualified Lead): Leads que bateram critério de ICP + sinal de interesse (Etapa de Qualificação, Interesse ou Apresentação)
  const mqlCount = sQualificacao + sEmailAberto + sInteresse + sApresentacao + sProposta + sFechamento;
  const mqlRate = totalLeads > 0 ? ((mqlCount / totalLeads) * 100).toFixed(1) : '0.0';

  // 4. Taxa de Agendamento: Reuniões marcadas (Apresentação/Proposta) ÷ MQLs trabalhados
  const meetingsScheduled = sApresentacao + sProposta + sFechamento;
  const appointmentRate = mqlCount > 0 ? ((meetingsScheduled / mqlCount) * 100).toFixed(1) : '0.0';

  // 5. Taxa de Show (Comparecimento): Reuniões realizadas (Proposta/Fechamento) ÷ reuniões marcadas
  const meetingsDone = sProposta + sFechamento;
  const showRate = meetingsScheduled > 0 ? ((meetingsDone / meetingsScheduled) * 100).toFixed(1) : '0.0';

  // 6. CPR (Custo Por Reunião Realizada)
  const totalCost = sdrCost + toolsCost + leadsCost;
  const cprValue = meetingsDone > 0 ? (totalCost / meetingsDone).toFixed(2) : '0.00';

  // 7. CAC de Outbound (Custo de Aquisição de Clientes)
  const closedDeals = sFechamento + sPosVenda;
  const cacValue = closedDeals > 0 ? (totalCost / closedDeals).toFixed(2) : '0.00';

  // Funil de Vendas do getLOG
  const funnelSteps = [
    { label: '1. Prospecção (Lista)', value: totalLeads, color: '#6366f1', pct: 100 },
    { label: '2. Qualificação (Contatados)', value: mqlCount, color: '#f59e0b', pct: totalLeads > 0 ? Math.round((mqlCount / totalLeads) * 100) : 0 },
    { label: '3. Apresentação (Demo getLOG)', value: meetingsScheduled, color: '#3b82f6', pct: totalLeads > 0 ? Math.round((meetingsScheduled / totalLeads) * 100) : 0 },
    { label: '4. Proposta Enviada', value: sProposta + sFechamento, color: '#ec4899', pct: totalLeads > 0 ? Math.round(((sProposta + sFechamento) / totalLeads) * 100) : 0 },
    { label: '5. Clientes Fechados', value: closedDeals, color: '#10b981', pct: totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0 },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📈 Métricas & Outbound (getLOG)</div>
          <div className="page-description">Análise de eficiência do funil, conversões e custos de outbound em tempo real</div>
        </div>
      </div>

      {/* --- CARDS DAS 7 MÉTRICAS DE OURO --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* 1. Taxa de Conexão */}
        <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>1. Taxa de Conexão</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#6366f1', marginTop: 6 }}>{connectionRate}%</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            Conversas reais ({totalConnected}) ÷ Ligações tentadas ({totalDials})
          </div>
        </div>

        {/* 2. Taxa de Resposta */}
        <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>2. Taxa de Resposta</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0891b2', marginTop: 6 }}>{responseRate}%</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            Respostas ({totalResponses}) ÷ Envios ({totalSentTouches})
          </div>
        </div>

        {/* 3. MQL */}
        <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>3. MQLs Qualificados</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', marginTop: 6 }}>{mqlCount} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>({mqlRate}%)</span></div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            Leads qualificados que bateram critério de ICP
          </div>
        </div>

        {/* 4. Taxa de Agendamento */}
        <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>4. Taxa de Agendamento</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#7c3aed', marginTop: 6 }}>{appointmentRate}%</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            Demos agendadas ({meetingsScheduled}) ÷ MQLs ({mqlCount})
          </div>
        </div>

        {/* 5. Taxa de Show */}
        <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>5. Taxa de Show</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#ec4899', marginTop: 6 }}>{showRate}%</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            Demos realizadas ({meetingsDone}) ÷ Agendadas ({meetingsScheduled})
          </div>
        </div>
      </div>

      {/* --- CUSTOS, CPR E CAC --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* CPR & CAC */}
        <div className="table-wrap" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.5 }}>💰 Métricas Financeiras de Outbound</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--surface-2, #f9fafb)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>6. CPR (Custo por Reunião)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c', marginTop: 4 }}>R$ {cprValue}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Custo total ÷ Demos realizadas</div>
            </div>
            <div style={{ background: 'var(--surface-2, #f9fafb)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>7. CAC de Outbound</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>R$ {cacValue}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Custo total ÷ Contratos fechados</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            💡 **Análise de Eficiência**: Se o CPR estiver alto e o CAC estiver baixo, o problema está na geração de reuniões (SDR). Se o CPR estiver baixo e o CAC alto, o gargalo está na conversão comercial (vendas/proposta)!
          </div>
        </div>

        {/* Calculadora Interativa de Custos */}
        <div className="table-wrap" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 10 }}>⚙️ Calculadora de Custo Operacional</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Custo do SDR + Equipe (R$/mês)</span>
              <input type="number" className="field-input" style={{ width: 100, padding: '4px 8px', fontSize: 12, textAlign: 'right' }} value={sdrCost} onChange={e => setSdrCost(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Custo de Ferramentas/Software (R$/mês)</span>
              <input type="number" className="field-input" style={{ width: 100, padding: '4px 8px', fontSize: 12, textAlign: 'right' }} value={toolsCost} onChange={e => setToolsCost(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Custo de Leads/Dados (R$/mês)</span>
              <input type="number" className="field-input" style={{ width: 100, padding: '4px 8px', fontSize: 12, textAlign: 'right' }} value={leadsCost} onChange={e => setToolsDataCost(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 8, fontWeight: 700 }}>
              <span style={{ fontSize: 12 }}>Custo Total Outbound</span>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>R$ {totalCost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- FUNIL DE VENDAS E DISTRIBUIÇÃO --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Funil de Vendas */}
        <div className="table-wrap" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>🏆 Funil de Vendas do getLOG</div>
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

        {/* Distribuição de Status */}
        <div className="table-wrap" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>📋 Distribuição por Etapas Ativas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '1 · Prospecção', value: sProspeccao, color: '#6366f1' },
              { label: '2 · Qualificação', value: sQualificacao, color: '#f59e0b' },
              { label: '📬 E-mail Aberto', value: sEmailAberto, color: '#0891b2' },
              { label: '❤️ Interesse', value: sInteresse, color: '#d946ef' },
              { label: '3 · Apresentação', value: sApresentacao, color: '#3b82f6' },
              { label: '4 · Proposta Enviada', value: sProposta, color: '#ec4899' },
              { label: '5 · Fechamento (Ganho)', value: sFechamento, color: '#10b981' },
              { label: '6 · Pós-venda', value: sPosVenda, color: '#8b5cf6' },
              { label: '❌ Perdido', value: sPerdido, color: '#ef4444' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{s.value}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                  {totalLeads > 0 ? Math.round((s.value / totalLeads) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- ATIVIDADES DIÁRIAS E LIGAÇÕES --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Atividades Reais por Canal */}
        <div className="table-wrap" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>📣 Volume de Atividades Reais por Canal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '📞 Ligações Discadas (Dials)', value: totalDials, color: '#6366f1', icon: '📞' },
              { label: '✉️ E-mails Enviados', value: totalEmailsSent, color: '#4f46e5', icon: '✉️' },
              { label: '📬 E-mails Abertos', value: totalEmailsOpened, color: '#0891b2', icon: '📬' },
              { label: '💬 Mensagens de WhatsApp', value: totalWhatsSent, color: '#059669', icon: '💬' },
              { label: '💼 Mensagens de LinkedIn', value: totalLinkedinSent, color: '#0284c7', icon: '💼' },
            ].map((canal, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14 }}>{canal.icon}</span>
                <span style={{ fontSize: 12, flex: 1 }}>{canal.label}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{canal.value}</span>
                <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalOutboundTouches > 0 ? Math.round((canal.value / totalOutboundTouches) * 100) : 0}%`, background: canal.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Métricas de Ligações */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Carregando metricas de ligacoes...</div>
        ) : callStats ? (
          <div className="table-wrap" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>📞 Detalhamento das Ligações</div>
            <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-value" style={{ fontSize: 18 }}>{callStats.calls?.total || 0}</div><div className="stat-label">Total Dials</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: '#079455', fontSize: 18 }}>{totalConnected}</div><div className="stat-label">Conectadas</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: '#f79009', fontSize: 18 }}>{callStats.calls?.atendeu_interesse || 0}</div><div className="stat-label">Com Interesse</div></div>
            </div>
            {callStats.calls?.total > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Atendeu com interesse', value: callStats.calls.atendeu_interesse || 0, color: '#079455' },
                  { label: 'Atendeu sem interesse', value: callStats.calls.atendeu_sem_interesse || 0, color: '#f79009' },
                  { label: 'Nao atendeu', value: callStats.calls.nao_atendeu || 0, color: '#667085' },
                  { label: 'Caixa postal', value: callStats.calls.caixa_postal || 0, color: '#98a2b3' },
                  { label: 'Numero errado', value: callStats.calls.numero_errado || 0, color: '#d92d20' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{s.value}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
                      {callStats.calls.total > 0 ? Math.round((s.value / callStats.calls.total) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

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
