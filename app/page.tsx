'use client';

import { useState, useEffect, useCallback } from 'react';

interface Lead {
  id: string; workspace: string; name: string; company?: string; role?: string;
  email?: string; whatsapp?: string; linkedin?: string; phone?: string;
  source?: string; notes?: string; status: string; created_at: number; updated_at: number;
}

const WORKSPACES = [
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
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  search2: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
};

export default function CRM() {
  const [workspace, setWorkspace] = useState('lottus');
  const [view, setView] = useState('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hasDb, setHasDb] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const ws = WORKSPACES.find(w => w.id === workspace)!;
  const account = accounts.find(a => a.workspace === workspace);

  // init
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/init'); const j = await r.json(); setHasDb(!!j.hasDatabase); } catch { setHasDb(false); }
      await loadAccounts();
    })();
    // feedback do OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'ok') { showToast('Conta Google conectada'); window.history.replaceState({}, '', '/'); }
    if (params.get('auth') === 'error') { showToast('Falha ao conectar conta'); window.history.replaceState({}, '', '/'); }
  }, []);

  const loadAccounts = async () => {
    try { const r = await fetch('/api/accounts'); const j = await r.json(); setAccounts(j.accounts || []); setOauthConfigured(!!j.configured); } catch {}
  };

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

  const filtered = leads.filter(l => {
    const t = search.toLowerCase();
    const ms = !t || l.name.toLowerCase().includes(t) || (l.email || '').toLowerCase().includes(t) || (l.company || '').toLowerCase().includes(t);
    return ms && (statusFilter === 'all' || l.status === statusFilter);
  });
  const stats = { total: leads.length, novos: leads.filter(l => l.status === 'novo').length, negociacao: leads.filter(l => l.status === 'negociacao').length, fechados: leads.filter(l => l.status === 'fechado').length };

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header"><div className="logo">IT</div><div className="logo-text">ITskill<span>CRM</span></div></div>
        <div className="sidebar-section">
          <div className="section-label">Workspaces</div>
          {WORKSPACES.map(w => {
            const a = accounts.find(x => x.workspace === w.id);
            return (
              <button key={w.id} className={`ws-item${w.id === workspace ? ' active' : ''}`} onClick={() => { setWorkspace(w.id); setSidebarOpen(false); }}>
                <span className="ws-dot" style={{ background: w.color }} />
                <span>{w.name}</span>
                {a?.connected && <span title="Gmail conectado" style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: 9, background: 'var(--success)' }} />}
              </button>
            );
          })}
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
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ws.name} <span style={{ color: 'var(--text-muted)' }}>/</span> <strong style={{ color: 'var(--text)' }}>{view === 'leads' ? 'Leads' : view === 'inbox' ? 'Caixa de Entrada' : 'Configurações'}</strong></span>
          {account?.connected
            ? <span className="db-badge on">{account.email}</span>
            : <span className="db-badge off">Gmail não conectado</span>}
        </header>

        <div className="content"><div className="content-narrow">
          {view === 'leads' && (
            <>
              <div className="page-header">
                <div><div className="page-title">Leads</div><div className="page-description">{ws.name} · {leads.length} contato(s)</div></div>
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
                      <td><div className="cell-primary">{lead.name}</div><div className="cell-secondary">{lead.company || '—'}{lead.role ? ` · ${lead.role}` : ''}</div></td>
                      <td>{lead.email && <div className="cell-secondary">{lead.email}</div>}{lead.whatsapp && <div className="cell-secondary">+{lead.whatsapp}</div>}{!lead.email && !lead.whatsapp && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                      <td><span className={`badge badge-${lead.status}`}>{statusLabel(lead.status)}</span></td>
                      <td onClick={e => e.stopPropagation()}><div className="channel-icons">
                        <button className="ch-icon" disabled={!lead.email} title="E-mail" onClick={() => { setEditing(lead); setView('inbox'); }}><Icon d={ICONS.email} /></button>
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

          {view === 'inbox' && <InboxView workspace={workspace} account={account} oauthConfigured={oauthConfigured} leads={leads} showToast={showToast} />}

          {view === 'search' && <SearchView workspace={workspace} onImport={async (newLeads: any[]) => {
            const now = Date.now();
            for (const nl of newLeads) {
              await saveLead({ id: uid(), workspace, name: nl.name, company: nl.company || '', role: nl.role || '', email: nl.email || '', whatsapp: cleanPhone(nl.whatsapp || nl.phone || ''), linkedin: nl.linkedin || '', phone: nl.phone || '', source: nl.source || 'Prospecção', notes: '', status: 'novo', created_at: now, updated_at: now } as Lead);
            }
            showToast(newLeads.length + ' lead(s) importado(s)');
          }} showToast={showToast} />}

          {view === 'settings' && <SettingsView accounts={accounts} oauthConfigured={oauthConfigured} hasDb={hasDb} onReload={loadAccounts} showToast={showToast} />}
        </div></div>
      </div>

      {modalOpen && <LeadModal lead={editing} workspace={workspace} onClose={() => setModalOpen(false)} onSave={async (l: Lead) => { await saveLead(l); setModalOpen(false); showToast(editing ? 'Lead atualizado' : 'Lead criado'); }} onDelete={editing ? async () => { await removeLead(editing.id); setModalOpen(false); } : undefined} />}
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}

// ---------- Caixa de Entrada (Gmail real) ----------
function InboxView({ workspace, account, oauthConfigured, leads, showToast }: any) {
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const loadInbox = useCallback(async () => {
    if (!account?.connected) return;
    setLoading(true);
    try { const r = await fetch(`/api/gmail/inbox?workspace=${workspace}&max=25`); const j = await r.json(); setMessages(j.messages || []); }
    catch { setMessages([]); }
    setLoading(false);
  }, [workspace, account]);

  useEffect(() => { if (tab === 'inbox') loadInbox(); }, [tab, loadInbox]);

  const send = async () => {
    if (!compose.to) { showToast('Informe o destinatário'); return; }
    setSending(true);
    try {
      const r = await fetch('/api/gmail/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, ...compose }) });
      const j = await r.json();
      if (j.ok) { showToast('E-mail enviado'); setCompose({ to: '', subject: '', body: '' }); setTab('inbox'); }
      else showToast('Erro: ' + (j.error || 'falha no envio'));
    } catch { showToast('Erro ao enviar'); }
    setSending(false);
  };

  if (!oauthConfigured) {
    return (
      <>
        <div className="page-header"><div><div className="page-title">Caixa de Entrada</div><div className="page-description">Integração Gmail</div></div></div>
        <div className="alert alert-warn">A integração com o Gmail ainda não foi configurada no servidor. Defina as credenciais do Google (veja o guia GUIA_GOOGLE.md) e adicione as variáveis de ambiente na Vercel.</div>
      </>
    );
  }
  if (!account?.connected) {
    return (
      <>
        <div className="page-header"><div><div className="page-title">Caixa de Entrada</div><div className="page-description">Conecte o Gmail deste workspace</div></div></div>
        <div className="empty-state">
          <div className="empty-title">Gmail não conectado</div>
          <div className="empty-text">Conecte a conta Google deste workspace para enviar e receber e-mails aqui.</div>
          <a className="google-btn" href={`/api/auth/google?workspace=${workspace}`}>
            <svg className="google-g" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Conectar com Google
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div><div className="page-title">Caixa de Entrada</div><div className="page-description">{account.email}</div></div>
        <div className="page-actions">
          {tab === 'inbox' && <button className="btn" onClick={loadInbox}><Icon d={ICONS.refresh} />Atualizar</button>}
          <button className="btn btn-primary" onClick={() => setTab(tab === 'compose' ? 'inbox' : 'compose')}><Icon d={tab === 'compose' ? ICONS.inbox : ICONS.send} />{tab === 'compose' ? 'Ver caixa' : 'Escrever'}</button>
        </div>
      </div>

      {tab === 'inbox' ? (
        loading ? <div className="empty-state"><div className="empty-text">Carregando e-mails...</div></div>
        : messages.length === 0 ? <div className="empty-state"><div className="empty-title">Caixa vazia</div><div className="empty-text">Nenhum e-mail recente encontrado</div></div>
        : <div className="table-wrap"><div className="mail-list">{messages.map(m => (
            <div className="mail-item" key={m.id}>
              <div className={`mail-from${m.unread ? ' unread' : ''}`}>{(m.from || '').replace(/<.*>/, '').trim() || m.from}</div>
              <div className="mail-subject">{m.subject || '(sem assunto)'} <span>— {m.snippet}</span></div>
              <div className="mail-date">{new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
            </div>
          ))}</div></div>
      ) : (
        <div className="table-wrap" style={{ padding: 18, maxWidth: 640 }}>
          <div className="field"><label className="field-label">Para</label>
            <input className="field-input" list="lead-emails" value={compose.to} onChange={e => setCompose({ ...compose, to: e.target.value })} placeholder="cliente@empresa.com" />
            <datalist id="lead-emails">{leads.filter((l: Lead) => l.email).map((l: Lead) => <option key={l.id} value={l.email}>{l.name}</option>)}</datalist>
          </div>
          <div className="field"><label className="field-label">Assunto</label><input className="field-input" value={compose.subject} onChange={e => setCompose({ ...compose, subject: e.target.value })} /></div>
          <div className="field"><label className="field-label">Mensagem</label><textarea className="field-textarea" style={{ minHeight: 180 }} value={compose.body} onChange={e => setCompose({ ...compose, body: e.target.value })} /></div>
          <button className="btn btn-primary" onClick={send} disabled={sending}><Icon d={ICONS.send} />{sending ? 'Enviando...' : `Enviar de ${account.email}`}</button>
        </div>
      )}
    </>
  );
}

// ---------- Configurações ----------
function SettingsView({ accounts, oauthConfigured, hasDb, onReload, showToast }: any) {
  const disconnect = async (ws: string) => {
    if (!confirm('Desconectar esta conta Google?')) return;
    await fetch(`/api/accounts?workspace=${ws}`, { method: 'DELETE' });
    await onReload(); showToast('Conta desconectada');
  };

  return (
    <>
      <div className="page-header"><div><div className="page-title">Configurações</div><div className="page-description">Contas de e-mail e integrações</div></div></div>

      {!oauthConfigured && (
        <div className="alert alert-warn">As credenciais do Google ainda não foram configuradas. Siga o guia <strong>GUIA_GOOGLE.md</strong> para criar o Client ID/Secret e adicione como variáveis de ambiente na Vercel (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).</div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 12px' }}>Contas Google por workspace</div>
      {WORKSPACES.map(w => {
        const a = accounts.find((x: any) => x.workspace === w.id);
        return (
          <div className="account-card" key={w.id}>
            <span className="ws-dot" style={{ background: w.color, width: 10, height: 10 }} />
            <div className="account-info">
              <div className="account-ws">{w.name}</div>
              <div className="account-email">{a?.connected ? a.email : 'Nenhuma conta conectada'}</div>
            </div>
            {a?.connected
              ? <button className="btn btn-danger btn-sm" onClick={() => disconnect(w.id)}>Desconectar</button>
              : <a className="google-btn" href={`/api/auth/google?workspace=${w.id}`} style={{ pointerEvents: oauthConfigured ? 'auto' : 'none', opacity: oauthConfigured ? 1 : 0.5 }}>
                  <svg className="google-g" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  Conectar
                </a>}
          </div>
        );
      })}

      <div style={{ fontSize: 13, fontWeight: 600, margin: '24px 0 12px' }}>Banco de dados</div>
      <div className="account-card">
        <div className="account-info">
          <div className="account-ws">Armazenamento</div>
          <div className="account-email">{hasDb ? 'Postgres conectado — dados na nuvem' : 'Modo local — dados salvos no navegador'}</div>
        </div>
        <span className={`account-status ${hasDb ? 'connected' : 'disconnected'}`}>{hasDb ? 'Nuvem' : 'Local'}</span>
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
                  {r.logo && (
                    <img src={r.logo} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', flexShrink: 0 }}
                      onError={(e: any) => { e.target.style.display = 'none'; }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{r.name || r.company}</div>
                    {r.industry && <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500, marginTop: 2 }}>{r.industry}</div>}
                  </div>
                  <button className="btn btn-sm" style={{ flexShrink: 0, fontSize: 11, padding: '5px 10px', borderRadius: 8 }} onClick={() => onImport([r])}>+ Lead</button>
                </div>
                {(r.city || r.employees || r.revenue) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {r.city && <span>📍 {r.city}{r.country ? `, ${r.country}` : ''}</span>}
                    {r.employees && <span>👥 {r.employees}</span>}
                    {r.revenue && <span>💰 {r.revenue}</span>}
                  </div>
                )}
                {r.email && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉️ {r.email}</div>
                )}
                {r.website && (
                  <a href={r.website.startsWith('http') ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', marginBottom: 4 }}>🌐 {r.website}</a>
                )}
                {r.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</div>
                )}
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
              </div>
              {importPreview.length > 10 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>...e mais {importPreview.length - 10}</div>}
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
    onSave({ id: f.id || uid(), workspace, name: f.name.trim(), company: f.company || '', role: f.role || '', email: f.email || '', whatsapp: cleanPhone(f.whatsapp || ''), linkedin: f.linkedin || '', phone: f.phone || '', source: f.source || '', notes: f.notes || '', status: f.status || 'novo', created_at: f.created_at || now, updated_at: now });
  };
  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header"><div className="modal-title">{lead ? 'Editar lead' : 'Novo lead'}</div><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="field-row"><div className="field"><label className="field-label">Nome *</label><input className="field-input" value={f.name || ''} onChange={e => set('name', e.target.value)} /></div><div className="field"><label className="field-label">Empresa</label><input className="field-input" value={f.company || ''} onChange={e => set('company', e.target.value)} /></div></div>
          <div className="field-row"><div className="field"><label className="field-label">Cargo</label><input className="field-input" value={f.role || ''} onChange={e => set('role', e.target.value)} /></div><div className="field"><label className="field-label">Status</label><select className="field-select" value={f.status || 'novo'} onChange={e => set('status', e.target.value)}><option value="novo">Novo</option><option value="contatado">Contatado</option><option value="negociacao">Em negociação</option><option value="fechado">Fechado</option><option value="perdido">Perdido</option></select></div></div>
          <div className="field-row"><div className="field"><label className="field-label">E-mail</label><input className="field-input" type="email" value={f.email || ''} onChange={e => set('email', e.target.value)} /></div><div className="field"><label className="field-label">WhatsApp</label><input className="field-input" type="tel" placeholder="5541999999999" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} /></div></div>
          <div className="field-row"><div className="field"><label className="field-label">LinkedIn</label><input className="field-input" value={f.linkedin || ''} onChange={e => set('linkedin', e.target.value)} /></div><div className="field"><label className="field-label">Telefone</label><input className="field-input" type="tel" value={f.phone || ''} onChange={e => set('phone', e.target.value)} /></div></div>
          <div className="field"><label className="field-label">Anotações</label><textarea className="field-textarea" value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div className="modal-footer">{onDelete && <button className="btn btn-danger" onClick={onDelete} style={{ marginRight: 'auto' }}>Excluir</button>}<button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit}>Salvar</button></div>
      </div>
    </div>
  );
}
