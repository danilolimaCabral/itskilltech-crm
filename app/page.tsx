'use client';

import { useState, useEffect, useCallback } from 'react';

interface Lead {
  id: string; workspace: string; name: string; company?: string; role?: string;
  email?: string; whatsapp?: string; linkedin?: string; phone?: string;
  source?: string; notes?: string; status: string; created_at: number; updated_at: number;
  call_count?: number; last_contact?: number;
}

interface Workspace { id: string; name: string; color: string; }

const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'lottus', name: 'Lottus Tech', color: '#0066ff' },
  { id: 'iota', name: 'IOTA', color: '#6938ef' },
  { id: 'splice', name: 'Splice', color: '#079455' },
];

const STORAGE_KEY = 'itskill_crm_full_v1';
const uid = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
const cleanPhone = (p: string) => (p || '').replace(/\D/g, '');
const statusLabel = (s: string) => (({ novo: 'Novo', contatado: 'Contatado', negociacao: 'Em negociação', fechado: 'Fechado', perdido: 'Perdido' } as any)[s] || s);

const Icon = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

const ICONS: any = {
  leads: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.87-1.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  search2: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  enrich: '<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>',
  workspace: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
};

export default function CRM() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [workspace, setWorkspace] = useState('lottus');
  const [view, setView] = useState('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hasDb, setHasDb] = useState<boolean | null>(null);
  const [gmailConfigured, setGmailConfigured] = useState(false);
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  // Call modal
  const [callModal, setCallModal] = useState<Lead | null>(null);
  const [callResult, setCallResult] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [savingCall, setSavingCall] = useState(false);
  // Email compose modal
  const [emailModal, setEmailModal] = useState<Lead | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  // init
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/init');
        const j = await r.json();
        setHasDb(!!j.hasDatabase);
      } catch { setHasDb(false); }
      // check gmail smtp
      try {
        const r = await fetch('/api/email-status');
        const j = await r.json();
        setGmailConfigured(!!j.configured);
      } catch { setGmailConfigured(false); }
      // load workspaces from DB if available
      try {
        const r = await fetch('/api/workspaces');
        const j = await r.json();
        if (j.workspaces?.length) setWorkspaces(j.workspaces);
      } catch {}
    })();
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'ok') { showToast('Conta conectada'); window.history.replaceState({}, '', '/'); }
  }, []);

  const loadLeads = useCallback(async () => {
    if (hasDb) {
      try { const r = await fetch(`/api/leads?workspace=${workspace}`); const j = await r.json(); setLeads(j.leads || []); } catch { setLeads([]); }
    } else if (hasDb === false) {
      try { const raw = localStorage.getItem(STORAGE_KEY); const all = raw ? JSON.parse(raw) : {}; setLeads(all[workspace] || []); } catch { setLeads([]); }
    }
  }, [workspace, hasDb]);

  useEffect(() => { if (hasDb !== null) loadLeads(); }, [hasDb, workspace, loadLeads]);

  const persistLocal = (next: Lead[]) => {
    try { const raw = localStorage.getItem(STORAGE_KEY); const all = raw ? JSON.parse(raw) : {}; all[workspace] = next; localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
  };

  const saveLead = async (lead: Lead) => {
    if (hasDb) { await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) }); await loadLeads(); }
    else { const ex = leads.some(l => l.id === lead.id); const next = ex ? leads.map(l => l.id === lead.id ? lead : l) : [lead, ...leads]; setLeads(next); persistLocal(next); }
  };

  const removeLead = async (id: string) => {
    if (!confirm('Excluir este lead?')) return;
    if (hasDb) { await fetch(`/api/leads?id=${id}`, { method: 'DELETE' }); await loadLeads(); }
    else { const next = leads.filter(l => l.id !== id); setLeads(next); persistLocal(next); }
    showToast('Lead excluído');
  };

  const enrichLead = async (lead: Lead) => {
    if (!lead.company) { showToast('Lead sem empresa — não é possível enriquecer'); return; }
    setEnriching(lead.id);
    try {
      const r = await fetch('/api/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: lead.company }) });
      const d = await r.json();
      if (!d.ok) { showToast(d.error || 'Dados não encontrados'); return; }
      const updated: Lead = { ...lead, phone: d.telefone || lead.phone || '', updated_at: Date.now() };
      await saveLead(updated);
      showToast(`✓ Enriquecido: ${d.telefone || 'sem telefone'} · ${d.source}`);
    } catch { showToast('Erro ao enriquecer'); }
    setEnriching(null);
  };

  // Registrar ligação e mover lead de status
  const saveCall = async () => {
    if (!callResult || !callModal) return;
    setSavingCall(true);
    const STATUS_MAP: any = {
      atendeu_interesse: 'negociacao',
      atendeu_sem_interesse: 'contatado',
      nao_atendeu: null,
      caixa_postal: null,
      numero_errado: null,
    };
    const newStatus = STATUS_MAP[callResult];
    const updatedLead: Lead = {
      ...callModal,
      status: newStatus || callModal.status,
      call_count: (callModal.call_count || 0) + 1,
      last_contact: Date.now(),
      updated_at: Date.now(),
      notes: callNotes ? `[Ligação ${new Date().toLocaleDateString('pt-BR')}] ${callNotes}\n${callModal.notes || ''}` : callModal.notes,
    };
    try {
      // Salvar log de ligação no banco
      if (hasDb) {
        await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: callModal.id, workspace, result: callResult, notes: callNotes }),
        });
      }
      await saveLead(updatedLead);
      const resultLabels: any = { atendeu_interesse: '✓ Atendeu — interesse!', atendeu_sem_interesse: '✓ Atendeu — sem interesse', nao_atendeu: 'Não atendeu', caixa_postal: 'Caixa postal', numero_errado: 'Número errado' };
      showToast(resultLabels[callResult] || 'Ligação registrada');
    } catch { showToast('Erro ao registrar ligação'); }
    setCallModal(null); setCallResult(''); setCallNotes('');
    setSavingCall(false);
  };

  // Enviar e-mail via SMTP
  const sendEmail = async () => {
    if (!emailModal?.email) return;
    setSendingEmail(true);
    try {
      const r = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailModal.email, toName: emailModal.name, subject: emailSubject, body: emailBody }),
      });
      const j = await r.json();
      if (j.success) {
        showToast('✓ E-mail enviado para ' + emailModal.email);
        // Atualizar status para contatado se ainda for novo
        if (emailModal.status === 'novo') {
          await saveLead({ ...emailModal, status: 'contatado', updated_at: Date.now() });
        }
        setEmailModal(null); setEmailSubject(''); setEmailBody('');
      } else {
        showToast('Erro: ' + (j.error || 'falha no envio'));
      }
    } catch { showToast('Erro ao enviar e-mail'); }
    setSendingEmail(false);
  };

  const openEmailModal = (lead: Lead) => {
    setEmailModal(lead);
    setEmailSubject(`Apresentação ITskillTech — Solução TMS para ${lead.company || 'sua empresa'}`);
    setEmailBody(`Olá ${lead.name.split(' ')[0]},\n\nTudo bem?\n\nMeu nome é Danilo, sou da ITskillTech. Vi que você é ${lead.role || 'decisor'} na ${lead.company || 'sua empresa'} e acredito que nossa solução de TMS pode otimizar significativamente a operação logística de vocês.\n\nGostaria de agendar uma conversa rápida de 15 minutos para apresentar os resultados que estamos gerando para empresas do mesmo segmento.\n\nQual seria o melhor horário para você?\n\nAtenciosamente,\nDanilo\nITskillTech`);
  };

  const ws = workspaces.find(w => w.id === workspace) || workspaces[0];
  const filtered = leads.filter(l => {
    const t = search.toLowerCase();
    const ms = !t || l.name.toLowerCase().includes(t) || (l.email || '').toLowerCase().includes(t) || (l.company || '').toLowerCase().includes(t);
    return ms && (statusFilter === 'all' || l.status === statusFilter);
  });
  const stats = {
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    negociacao: leads.filter(l => l.status === 'negociacao').length,
    fechados: leads.filter(l => l.status === 'fechado').length,
  };

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header"><div className="logo">IT</div><div className="logo-text">ITskill<span>CRM</span></div></div>
        <div className="sidebar-section">
          <div className="section-label">Workspaces</div>
          {workspaces.map(w => (
            <button key={w.id} className={`ws-item${w.id === workspace ? ' active' : ''}`} onClick={() => { setWorkspace(w.id); setSidebarOpen(false); }}>
              <span className="ws-dot" style={{ background: w.color }} />
              <span>{w.name}</span>
            </button>
          ))}
          <button className="ws-item" style={{ opacity: 0.6, fontSize: 12 }} onClick={() => { setView('workspaces'); setSidebarOpen(false); }}>
            <Icon d={ICONS.plus} /><span>Novo workspace</span>
          </button>
        </div>
        <div className="sidebar-section">
          <div className="section-label">Navegação</div>
          {[['leads', 'Leads', ICONS.leads], ['search', 'Buscar Leads', ICONS.search2], ['inbox', 'Caixa de Entrada', ICONS.inbox], ['settings', 'Configurações', ICONS.settings]].map(([v, label, ic]) => (
            <button key={v} className={`nav-item${view === v ? ' active' : ''}`} onClick={() => { setView(v as string); setSidebarOpen(false); }}>
              <Icon d={ic as string} /><span>{label}</span>
            </button>
          ))}
        </div>
      </aside>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 150 }} />}

      <div className="main">
        <header className="topbar">
          <button className="btn menu-toggle" onClick={() => setSidebarOpen(true)}><Icon d='<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>' /></button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ws?.name} <span style={{ color: 'var(--text-muted)' }}>/</span> <strong style={{ color: 'var(--text)' }}>{view === 'leads' ? 'Leads' : view === 'inbox' ? 'Caixa de Entrada' : view === 'workspaces' ? 'Workspaces' : 'Configurações'}</strong></span>
          <span className={`db-badge ${gmailConfigured ? 'on' : 'off'}`}>{gmailConfigured ? '✉ E-mail ativo' : 'E-mail não configurado'}</span>
        </header>

        <div className="content"><div className="content-narrow">
          {view === 'leads' && (
            <>
              <div className="page-header">
                <div><div className="page-title">Leads</div><div className="page-description">{ws?.name} · {leads.length} contato(s)</div></div>
                <div className="page-actions"><button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Icon d={ICONS.plus} />Novo lead</button></div>
              </div>
              <div className="stats">
                <div className="stat"><div className="stat-label"><span className="stat-dot" style={{ background: '#475467' }} />Total</div><div className="stat-value">{stats.total}</div></div>
                <div className="stat"><div className="stat-label"><span className="stat-dot" style={{ background: 'var(--primary)' }} />Novos</div><div className="stat-value">{stats.novos}</div></div>
                <div className="stat"><div className="stat-label"><span className="stat-dot" style={{ background: 'var(--purple)' }} />Negociação</div><div className="stat-value">{stats.negociacao}</div></div>
                <div className="stat"><div className="stat-label"><span className="stat-dot" style={{ background: 'var(--success)' }} />Fechados</div><div className="stat-value">{stats.fechados}</div></div>
              </div>
              <div className="toolbar">
                <div className="search"><Icon d='<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="filter-group">{['all', 'novo', 'contatado', 'negociacao', 'fechado'].map(s => <button key={s} className={`filter-tab${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>{s === 'all' ? 'Todos' : statusLabel(s)}</button>)}</div>
              </div>
              {filtered.length === 0 ? (
                <div className="empty-state"><div className="empty-title">Nenhum lead</div><div className="empty-text">Adicione seu primeiro contato</div><button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Icon d={ICONS.plus} />Adicionar lead</button></div>
              ) : (
                <div className="table-wrap"><table className="data"><thead><tr><th>Lead</th><th>Contato</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead><tbody>
                  {filtered.map(lead => (
                    <tr key={lead.id} onClick={() => { setEditing(lead); setModalOpen(true); }}>
                      <td>
                        <div className="cell-primary">{lead.name}</div>
                        <div className="cell-secondary">{lead.company || '—'}{lead.role ? ` · ${lead.role}` : ''}</div>
                        {(lead.call_count || 0) > 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>📞 {lead.call_count} ligação(ões) · último: {lead.last_contact ? new Date(lead.last_contact).toLocaleDateString('pt-BR') : '—'}</div>}
                      </td>
                      <td>
                        {lead.email && <div className="cell-secondary">{lead.email}</div>}
                        {(lead.whatsapp || lead.phone) && <div className="cell-secondary">{lead.whatsapp || lead.phone}</div>}
                        {!lead.email && !lead.whatsapp && !lead.phone && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td><span className={`badge badge-${lead.status}`}>{statusLabel(lead.status)}</span></td>
                      <td onClick={e => e.stopPropagation()}><div className="channel-icons">
                        {/* Enriquecer */}
                        <button className="ch-icon enrich-btn" title={`Enriquecer: buscar telefone de ${lead.company || lead.name}`} disabled={enriching === lead.id} onClick={() => enrichLead(lead)}>
                          {enriching === lead.id ? <span style={{ fontSize: 10 }}>...</span> : <Icon d={ICONS.enrich} />}
                        </button>
                        {/* Ligar */}
                        <button className="ch-icon phone-btn" title={lead.phone || lead.whatsapp ? `Ligar: ${lead.phone || lead.whatsapp}` : 'Registrar ligação'} onClick={() => { setCallModal(lead); setCallResult(''); setCallNotes(''); }}>
                          <Icon d={ICONS.phone} />
                        </button>
                        {/* E-mail */}
                        <button className="ch-icon email-btn" disabled={!lead.email} title={lead.email ? `E-mail: ${lead.email}` : 'Sem e-mail'} onClick={() => openEmailModal(lead)}>
                          <Icon d={ICONS.email} />
                        </button>
                        {/* WhatsApp */}
                        <button className="ch-icon whatsapp-btn" disabled={!lead.whatsapp && !lead.phone} title={lead.whatsapp || lead.phone ? `WhatsApp: ${lead.whatsapp || lead.phone}` : 'Sem número'} onClick={() => {
                          const num = cleanPhone(lead.whatsapp || lead.phone || '');
                          const msg = encodeURIComponent(`Olá ${lead.name.split(' ')[0]}, tudo bem? Vi que você é ${lead.role || 'decisor'} na ${lead.company || 'sua empresa'} e gostaria de apresentar uma solução de TMS que pode otimizar sua operação logística. Posso te mostrar em 15 minutos?`);
                          window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
                        }}><Icon d={ICONS.whatsapp} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody></table></div>
              )}
            </>
          )}

          {view === 'inbox' && <InboxView workspace={workspace} gmailConfigured={gmailConfigured} leads={leads} showToast={showToast} />}
          {view === 'search' && <SearchView workspace={workspace} onImport={async (newLeads: any[]) => {
            const now = Date.now();
            for (const nl of newLeads) {
              await saveLead({ id: uid(), workspace, name: nl.name, company: nl.company || '', role: nl.role || '', email: nl.email || '', whatsapp: cleanPhone(nl.whatsapp || nl.phone || ''), linkedin: nl.linkedin || '', phone: nl.phone || '', source: nl.source || 'Prospecção', notes: '', status: 'novo', created_at: now, updated_at: now } as Lead);
            }
            showToast(newLeads.length + ' lead(s) importado(s)');
          }} showToast={showToast} />}
          {view === 'workspaces' && <WorkspacesView workspaces={workspaces} onReload={async () => {
            try { const r = await fetch('/api/workspaces'); const j = await r.json(); if (j.workspaces?.length) setWorkspaces(j.workspaces); } catch {}
          }} showToast={showToast} />}
          {view === 'settings' && <SettingsView gmailConfigured={gmailConfigured} hasDb={hasDb} showToast={showToast} />}
        </div></div>
      </div>

      {/* Modal de Lead */}
      {modalOpen && <LeadModal lead={editing} workspace={workspace} onClose={() => setModalOpen(false)} onSave={async (l: Lead) => { await saveLead(l); setModalOpen(false); showToast(editing ? 'Lead atualizado' : 'Lead criado'); }} onDelete={editing ? async () => { await removeLead(editing.id); setModalOpen(false); } : undefined} />}

      {/* Modal de Ligação */}
      {callModal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setCallModal(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">📞 Registrar Ligação</div>
              <button className="modal-close" onClick={() => setCallModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{callModal.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{callModal.company} · {callModal.role}</div>
              {(callModal.phone || callModal.whatsapp) && (
                <a href={`tel:${cleanPhone(callModal.phone || callModal.whatsapp || '')}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 16, textDecoration: 'none' }}>
                  <Icon d={ICONS.phone} /> Ligar: {callModal.phone || callModal.whatsapp}
                </a>
              )}
              <div className="field">
                <label className="field-label">Resultado da ligação *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { v: 'atendeu_interesse', label: '✅ Atendeu — tem interesse', color: '#079455' },
                    { v: 'atendeu_sem_interesse', label: '🟡 Atendeu — sem interesse', color: '#b54708' },
                    { v: 'nao_atendeu', label: '❌ Não atendeu', color: '#667085' },
                    { v: 'caixa_postal', label: '📬 Caixa postal', color: '#667085' },
                    { v: 'numero_errado', label: '🚫 Número errado', color: '#d92d20' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setCallResult(opt.v)} style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: `2px solid ${callResult === opt.v ? opt.color : 'var(--border)'}`, background: callResult === opt.v ? opt.color + '15' : 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: callResult === opt.v ? 600 : 400 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label className="field-label">Anotações (opcional)</label>
                <textarea className="field-textarea" style={{ minHeight: 70 }} value={callNotes} onChange={e => setCallNotes(e.target.value)} placeholder="Ex: Vai apresentar para o board em 2 semanas..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setCallModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!callResult || savingCall} onClick={saveCall}>{savingCall ? 'Salvando...' : 'Salvar ligação'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de E-mail */}
      {emailModal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEmailModal(null); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">✉ Enviar E-mail</div>
              <button className="modal-close" onClick={() => setEmailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Para: <strong>{emailModal.name}</strong> &lt;{emailModal.email}&gt;</div>
              {!gmailConfigured && (
                <div className="alert alert-warn" style={{ marginBottom: 12, fontSize: 12 }}>⚠ E-mail SMTP não configurado. Adicione GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis de ambiente da Vercel.</div>
              )}
              <div className="field">
                <label className="field-label">Assunto</label>
                <input className="field-input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Mensagem</label>
                <textarea className="field-textarea" style={{ minHeight: 200 }} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setEmailModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!emailModal.email || sendingEmail || !gmailConfigured} onClick={sendEmail}>
                <Icon d={ICONS.send} />{sendingEmail ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}

// ---------- Caixa de Entrada ----------
function InboxView({ workspace, gmailConfigured, leads, showToast }: any) {
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!compose.to) { showToast('Informe o destinatário'); return; }
    setSending(true);
    try {
      const r = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: compose.to, subject: compose.subject, body: compose.body }) });
      const j = await r.json();
      if (j.success) { showToast('E-mail enviado'); setCompose({ to: '', subject: '', body: '' }); }
      else showToast('Erro: ' + (j.error || 'falha no envio'));
    } catch { showToast('Erro ao enviar'); }
    setSending(false);
  };

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Caixa de Entrada</div><div className="page-description">Envio de e-mail via SMTP</div></div>
      </div>
      {!gmailConfigured && (
        <div className="alert alert-warn">
          <strong>E-mail SMTP não configurado.</strong> Para ativar o envio de e-mails, adicione as variáveis <code>GMAIL_USER</code> e <code>GMAIL_APP_PASSWORD</code> nas configurações de ambiente da Vercel e faça um novo deploy.
          <br /><br />
          <strong>Como gerar a App Password:</strong><br />
          1. Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a><br />
          2. Digite o nome <code>ITskillTech CRM</code> e clique em Criar<br />
          3. Copie a senha de 16 caracteres e adicione como <code>GMAIL_APP_PASSWORD</code> na Vercel
        </div>
      )}
      <div className="table-wrap" style={{ padding: 18, maxWidth: 640 }}>
        <div className="field"><label className="field-label">Para</label>
          <input className="field-input" list="lead-emails-inbox" value={compose.to} onChange={e => setCompose({ ...compose, to: e.target.value })} placeholder="cliente@empresa.com" />
          <datalist id="lead-emails-inbox">{leads.filter((l: Lead) => l.email).map((l: Lead) => <option key={l.id} value={l.email}>{l.name}</option>)}</datalist>
        </div>
        <div className="field"><label className="field-label">Assunto</label><input className="field-input" value={compose.subject} onChange={e => setCompose({ ...compose, subject: e.target.value })} /></div>
        <div className="field"><label className="field-label">Mensagem</label><textarea className="field-textarea" style={{ minHeight: 180 }} value={compose.body} onChange={e => setCompose({ ...compose, body: e.target.value })} /></div>
        <button className="btn btn-primary" onClick={send} disabled={sending || !gmailConfigured}><Icon d={ICONS.send} />{sending ? 'Enviando...' : 'Enviar e-mail'}</button>
      </div>
    </>
  );
}

// ---------- Workspaces ----------
function WorkspacesView({ workspaces, onReload, showToast }: any) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0066ff');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) { showToast('Nome obrigatório'); return; }
    setSaving(true);
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36);
    try {
      await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: name.trim(), color }) });
      await onReload();
      setName(''); showToast('Workspace criado: ' + name.trim());
    } catch { showToast('Erro ao criar workspace'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este workspace?')) return;
    try {
      await fetch(`/api/workspaces?id=${id}`, { method: 'DELETE' });
      await onReload(); showToast('Workspace excluído');
    } catch { showToast('Erro ao excluir'); }
  };

  return (
    <>
      <div className="page-header"><div><div className="page-title">Workspaces</div><div className="page-description">Gerencie seus espaços de trabalho</div></div></div>
      <div className="table-wrap" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Criar novo workspace</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}><label className="field-label">Nome</label><input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Clientes Varejo" /></div>
          <div className="field"><label className="field-label">Cor</label><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} /></div>
          <button className="btn btn-primary" onClick={create} disabled={saving}><Icon d={ICONS.plus} />{saving ? 'Criando...' : 'Criar'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workspaces.map((w: Workspace) => (
          <div key={w.id} className="account-card">
            <span className="ws-dot" style={{ background: w.color, width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }} />
            <div className="account-info"><div className="account-ws">{w.name}</div><div className="account-email" style={{ fontSize: 11 }}>ID: {w.id}</div></div>
            {!['lottus', 'iota', 'splice'].includes(w.id) && (
              <button className="btn btn-danger btn-sm" onClick={() => remove(w.id)}><Icon d={ICONS.trash} /></button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Configurações ----------
function SettingsView({ gmailConfigured, hasDb, showToast }: any) {
  return (
    <>
      <div className="page-header"><div><div className="page-title">Configurações</div><div className="page-description">Integrações e banco de dados</div></div></div>

      <div style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 12px' }}>E-mail (SMTP)</div>
      <div className="account-card">
        <div className="account-info">
          <div className="account-ws">Gmail SMTP</div>
          <div className="account-email">{gmailConfigured ? 'Configurado e ativo — envio de e-mails habilitado' : 'Não configurado — adicione GMAIL_USER e GMAIL_APP_PASSWORD na Vercel'}</div>
        </div>
        <span className={`account-status ${gmailConfigured ? 'connected' : 'disconnected'}`}>{gmailConfigured ? 'Ativo' : 'Inativo'}</span>
      </div>

      {!gmailConfigured && (
        <div className="alert alert-warn" style={{ marginTop: 12, fontSize: 12 }}>
          <strong>Para ativar o envio de e-mails:</strong><br />
          1. Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a><br />
          2. Crie uma App Password com o nome <code>ITskillTech CRM</code><br />
          3. Na Vercel, adicione: <code>GMAIL_USER=seu@gmail.com</code> e <code>GMAIL_APP_PASSWORD=senha16chars</code><br />
          4. Faça um novo deploy
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, margin: '24px 0 12px' }}>Banco de dados</div>
      <div className="account-card">
        <div className="account-info">
          <div className="account-ws">Armazenamento</div>
          <div className="account-email">{hasDb ? 'Postgres conectado — dados na nuvem' : 'Modo local — dados salvos no navegador'}</div>
        </div>
        <span className={`account-status ${hasDb ? 'connected' : 'disconnected'}`}>{hasDb ? 'Nuvem' : 'Local'}</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, margin: '24px 0 12px' }}>WhatsApp</div>
      <div className="account-card">
        <div className="account-info">
          <div className="account-ws">WhatsApp Web (link direto)</div>
          <div className="account-email">Ativo — clique no ícone verde em qualquer lead para abrir conversa com mensagem pré-pronta</div>
        </div>
        <span className="account-status connected">Ativo</span>
      </div>
    </>
  );
}

// ---------- Buscar Leads ----------
function SearchView({ workspace, onImport, showToast }: any) {
  const [tab, setTab] = useState('buscar');
  const [filters, setFilters] = useState({ country: 'Brasil', department: 'ti', level: 'decisores', industry: '', qty: '25' });
  const [briefing, setBriefing] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  const labels: any = {
    country: filters.country,
    department: ({ ti: 'TI / Tecnologia', operacoes: 'Operações', logistica: 'Logística', comercial: 'Comercial' } as any)[filters.department],
    level: ({ decisores: 'Decisores (C-level, Diretor, VP)', donos: 'Donos / Fundadores', gerencia: 'Gerência' } as any)[filters.level],
  };

  const genBriefing = () => {
    setBriefing(`Buscar ${filters.qty} leads (prospects):\n- País: ${labels.country}\n- Departamento: ${labels.department}\n- Nível: ${labels.level}${filters.industry ? `\n- Setor: ${filters.industry}` : ''}`);
  };

  const realSearch = async () => {
    setSearching(true); setResults([]);
    try {
      const r = await fetch('/api/prospect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filters) });
      const j = await r.json();
      if (j.ok) { setResults(j.leads || []); showToast(`${j.count} leads encontrados`); }
      else showToast('Busca: ' + (j.error || 'falhou'));
    } catch { showToast('Erro na busca'); }
    setSearching(false);
  };

  const handleFile = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = (await import('xlsx')).default || (await import('xlsx'));
    const data = await file.arrayBuffer();
    const wb = (XLSX as any).read(data);
    const rows = (XLSX as any).utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const mapped = rows.map((row: any) => {
      const get = (...keys: string[]) => { for (const k of Object.keys(row)) { if (keys.some(t => k.toLowerCase().includes(t))) return row[k]; } return ''; };
      return { name: get('nome', 'name'), company: get('empresa', 'company', 'organização'), role: get('cargo', 'title', 'role'), email: get('email', 'e-mail'), whatsapp: get('whats', 'celular', 'telefone', 'phone'), linkedin: get('linkedin') };
    }).filter((r: any) => r.name);
    setImportPreview(mapped);
    showToast(`${mapped.length} linha(s) lida(s)`);
  };

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Buscar Leads</div><div className="page-description">Prospecção e importação de contatos</div></div>
      </div>
      <div className="filter-group" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`filter-tab${tab === 'buscar' ? ' active' : ''}`} onClick={() => setTab('buscar')}>Buscar (API)</button>
        <button className={`filter-tab${tab === 'briefing' ? ' active' : ''}`} onClick={() => setTab('briefing')}>Briefing</button>
        <button className={`filter-tab${tab === 'importar' ? ' active' : ''}`} onClick={() => setTab('importar')}>Importar</button>
      </div>
      {(tab === 'buscar' || tab === 'briefing') && (
        <div className="table-wrap" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field"><label className="field-label">País</label><select className="field-select" value={filters.country} onChange={e => setFilters({ ...filters, country: e.target.value })}><option>Brasil</option><option>Estados Unidos</option><option>Portugal</option></select></div>
            <div className="field"><label className="field-label">Setor</label><select className="field-select" value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })}><option value="ti">TI / Tecnologia</option><option value="operacoes">Operações</option><option value="logistica">Logística</option><option value="comercial">Comercial</option></select></div>
            <div className="field"><label className="field-label">Nível</label><select className="field-select" value={filters.level} onChange={e => setFilters({ ...filters, level: e.target.value })}><option value="decisores">C-level / Diretor</option><option value="donos">Donos / Fundadores</option><option value="gerencia">Gerência</option></select></div>
            <div className="field"><label className="field-label">Qtd</label><select className="field-select" value={filters.qty} onChange={e => setFilters({ ...filters, qty: e.target.value })}><option>25</option><option>50</option><option>100</option></select></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label className="field-label">Segmento (opcional)</label><input className="field-input" value={filters.industry} onChange={e => setFilters({ ...filters, industry: e.target.value })} placeholder="Ex: varejo, saúde, indústria..." /></div>
          {tab === 'buscar' ? (
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={realSearch} disabled={searching}>
              <Icon d={ICONS.search2} />{searching ? 'Buscando...' : 'Buscar leads reais'}
            </button>
          ) : (
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={genBriefing}><Icon d={ICONS.search2} />Gerar briefing</button>
          )}
        </div>
      )}
      {tab === 'briefing' && briefing && (
        <div className="table-wrap" style={{ padding: 16 }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{briefing}</div>
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(briefing); showToast('Briefing copiado'); }}>Copiar briefing</button>
        </div>
      )}
      {tab === 'buscar' && results.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <strong style={{ fontSize: 13 }}>{results.length} resultado(s)</strong>
            <button className="btn btn-primary btn-sm" onClick={() => onImport(results)}><Icon d={ICONS.download} />Importar todos</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  {r.logo && <img src={r.logo} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', flexShrink: 0 }} onError={(e: any) => { e.target.style.display = 'none'; }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{r.name || r.company}</div>
                    {r.industry && <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500, marginTop: 2 }}>{r.industry}</div>}
                  </div>
                  <button className="btn btn-sm" style={{ flexShrink: 0, fontSize: 11, padding: '5px 10px', borderRadius: 8 }} onClick={() => onImport([r])}>+ Lead</button>
                </div>
                {(r.city || r.employees) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {r.city && <span>📍 {r.city}</span>}
                    {r.employees && <span>👥 {r.employees}</span>}
                  </div>
                )}
                {r.email && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>✉️ {r.email}</div>}
                {r.website && <a href={r.website.startsWith('http') ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--primary)', display: 'block', marginBottom: 4 }}>🌐 {r.website}</a>}
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'importar' && (
        <div className="table-wrap" style={{ padding: 16 }}>
          <div className="alert alert-info" style={{ fontSize: 13 }}>Envie uma planilha (CSV ou Excel). Colunas reconhecidas: nome, empresa, cargo, email, telefone/whatsapp, linkedin.</div>
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', width: '100%', justifyContent: 'center', marginTop: 8 }}>
            <Icon d={ICONS.upload} />Escolher arquivo
            <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          </label>
          {importPreview.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>{importPreview.length} contato(s)</strong>
                <button className="btn btn-primary btn-sm" onClick={() => { onImport(importPreview); setImportPreview([]); }}><Icon d={ICONS.download} />Importar todos</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {importPreview.slice(0, 10).map((r, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                    {r.company && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.company}</div>}
                    {r.email && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>✉️ {r.email}</div>}
                  </div>
                ))}
                {importPreview.length > 10 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>...e mais {importPreview.length - 10}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Modal de Lead ----------
function LeadModal({ lead, workspace, onClose, onSave, onDelete }: any) {
  const [f, setF] = useState<any>(lead || { status: 'novo' });
  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.name?.trim()) { alert('Nome é obrigatório'); return; }
    const now = Date.now();
    onSave({ id: f.id || uid(), workspace, name: f.name.trim(), company: f.company || '', role: f.role || '', email: f.email || '', whatsapp: cleanPhone(f.whatsapp || ''), linkedin: f.linkedin || '', phone: f.phone || '', source: f.source || '', notes: f.notes || '', status: f.status || 'novo', created_at: f.created_at || now, updated_at: now, call_count: f.call_count || 0, last_contact: f.last_contact || null });
  };
  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{lead ? 'Editar lead' : 'Novo lead'}</div><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field"><label className="field-label">Nome *</label><input className="field-input" value={f.name || ''} onChange={e => set('name', e.target.value)} /></div>
            <div className="field"><label className="field-label">Empresa</label><input className="field-input" value={f.company || ''} onChange={e => set('company', e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label className="field-label">Cargo</label><input className="field-input" value={f.role || ''} onChange={e => set('role', e.target.value)} /></div>
            <div className="field"><label className="field-label">Status</label><select className="field-select" value={f.status || 'novo'} onChange={e => set('status', e.target.value)}><option value="novo">Novo</option><option value="contatado">Contatado</option><option value="negociacao">Em negociação</option><option value="fechado">Fechado</option><option value="perdido">Perdido</option></select></div>
          </div>
          <div className="field-row">
            <div className="field"><label className="field-label">E-mail</label><input className="field-input" type="email" value={f.email || ''} onChange={e => set('email', e.target.value)} /></div>
            <div className="field"><label className="field-label">WhatsApp</label><input className="field-input" type="tel" placeholder="5541999999999" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label className="field-label">Telefone</label><input className="field-input" type="tel" value={f.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className="field"><label className="field-label">LinkedIn</label><input className="field-input" value={f.linkedin || ''} onChange={e => set('linkedin', e.target.value)} /></div>
          </div>
          <div className="field"><label className="field-label">Anotações</label><textarea className="field-textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="modal-footer">{onDelete && <button className="btn btn-danger" onClick={onDelete} style={{ marginRight: 'auto' }}>Excluir</button>}<button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit}>Salvar</button></div>
      </div>
    </div>
  );
}
