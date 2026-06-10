'use client';
import React, { useState, useEffect, useCallback } from 'react';

// Estilos mobile
const mobileStyle = `
  @media (max-width: 768px) {
    .gestor-grid-2 { grid-template-columns: 1fr !important; }
    .gestor-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .gestor-header { padding: 14px 16px !important; flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
    .gestor-content { padding: 16px 12px !important; }
    .gestor-priority-row { flex-direction: column !important; }
    .gestor-priority-row input { width: 100% !important; }
    .gestor-lead-form-grid { grid-template-columns: 1fr !important; }
  }
`;

const WORKSPACE = 'lottus';

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 8, height: 6, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 8, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: `0 0 6px ${color}44` }} />
    </div>
  );
}

export default function GestorPage() {
  const [goals, setGoals] = useState({ whatsapp_goal: 20, email_goal: 20, call_goal: 10, total_goal: 50 });
  const [editGoals, setEditGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ ...goals });
  const [stats, setStats] = useState<any>({ days: [], totals: { whatsapp: 0, email: 0, call: 0, total: 0 } });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [savingGoals, setSavingGoals] = useState(false);
  const [toast, setToast] = useState('');

  const [leads, setLeads] = useState<any[]>([]);
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsFilter, setLeadsFilter] = useState('all');
  const [commentLead, setCommentLead] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [pendingLeads, setPendingLeads] = useState<any[]>([]);
  const [newPendingLead, setNewPendingLead] = useState({ name: '', company: '', phone: '', email: '', note: '' });
  const [addingPending, setAddingPending] = useState(false);
  const [dayModal, setDayModal] = useState<{ date: string; channel: string; channelLabel: string; leads: any[] } | null>(null);
  const [liFilter, setLiFilter] = useState<'all'|'with_li'|'without_li'>('with_li');
  const [liSearch, setLiSearch] = useState('');
  const [liMsgLead, setLiMsgLead] = useState<any>(null);
  const [liMsg, setLiMsg] = useState('');

  // Aplicar classe no body para habilitar scroll
  useEffect(() => {
    document.body.classList.add('gestor-page');
    document.documentElement.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.classList.remove('gestor-page');
      document.documentElement.style.height = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, statsRes, sugRes, leadsRes] = await Promise.all([
        fetch(`/api/gestor-goals?workspace=${WORKSPACE}`),
        fetch(`/api/gestor-stats?workspace=${WORKSPACE}&days=${period}`),
        fetch(`/api/gestor-suggestions?workspace=${WORKSPACE}`),
        fetch(`/api/leads?workspace=${WORKSPACE}`),
      ]);
      const g = await goalsRes.json();
      const s = await statsRes.json();
      const sug = await sugRes.json();
      const leadsData = await leadsRes.json();
      setGoals(g);
      setGoalDraft(g);
      setStats(s);
      setSuggestions(Array.isArray(sug) ? sug : []);
      const allLeads = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
      setLeads(allLeads);
      // Leads pendentes = leads com status 'pending' ou com gestor_note
      setPendingLeads(allLeads.filter((l: any) => l.status === 'pending' || l.gestor_note));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const saveGoals = async () => {
    setSavingGoals(true);
    await fetch('/api/gestor-goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace: WORKSPACE, ...goalDraft }),
    });
    setGoals(goalDraft);
    setEditGoals(false);
    setSavingGoals(false);
    showToast('✅ Metas salvas com sucesso!');
  };

  const sendSuggestion = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    await fetch('/api/gestor-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace: WORKSPACE, message: newMsg, from_name: 'Vandir', priority }),
    });
    setNewMsg('');
    setPriority('normal');
    setSending(false);
    showToast('✅ Sugestão enviada para o Danilo!');
    load();
  };

  // Dados de hoje
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayData = stats.days?.find((d: any) => d.date === todayKey) || { whatsapp: 0, email: 0, call: 0, total: 0, leads: [] };

  // Dia selecionado para detalhe
  const selectedData = selectedDay ? stats.days?.find((d: any) => d.date === selectedDay) : null;

  const unreadSuggestions = suggestions.filter((s: any) => !s.read_at).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{mobileStyle}</style>
      {/* Topbar clean */}
      <div className="gestor-header" style={{ background: '#fff', borderBottom: '1px solid #e8edf2', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0066ff, #0044cc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 16 }}>📊</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>Painel do Gestor</div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>getLOG/Lottustech</div>
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: '#e2e8f0' }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Monitoramento de Prospecção</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#475569' }}>Olá, <strong style={{ color: '#1e293b' }}>Vandir</strong> 👋</div>
          <button onClick={load} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}>
            🔄 Atualizar
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#fff', color: '#16a34a', padding: '12px 20px', borderRadius: 12, zIndex: 9999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8, animation: 'slideIn 0.2s ease' }}>
          <span style={{ fontSize: 18 }}>✅</span> {toast.replace('✅ ', '')}
          <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        </div>
      )}

      <div className="gestor-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#0066ff', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ color: '#64748b', fontSize: 14 }}>Carregando dados...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Cards de hoje — clicáveis por canal */}
            <div className="gestor-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'WhatsApp Hoje', value: todayData.whatsapp, goal: goals.whatsapp_goal, color: '#16a34a', bg: '#f0fdf4', icon: '💬', channel: 'whatsapp', channelLabel: 'WhatsApp' },
                { label: 'E-mails Hoje', value: todayData.email, goal: goals.email_goal, color: '#1a56db', bg: '#eff6ff', icon: '✉', channel: 'email', channelLabel: 'E-mail' },
                { label: 'Ligações Hoje', value: todayData.call, goal: goals.call_goal, color: '#ea580c', bg: '#fff7ed', icon: '📞', channel: 'call', channelLabel: 'Ligação' },
                { label: 'Total Hoje', value: todayData.total, goal: goals.total_goal, color: '#7c3aed', bg: '#f5f3ff', icon: '🎯', channel: 'all', channelLabel: 'Todos os canais' },
              ].map(c => {
                const todayKey = new Date().toISOString().slice(0, 10);
                const dayLeads = todayData.leads || [];
                const filteredLeads = c.channel === 'all' ? dayLeads : dayLeads.filter((l: any) => l.channels?.includes(c.channel));
                return (
                  <div key={c.label}
                    onClick={() => c.value > 0 && setDayModal({ date: todayKey, channel: c.channel, channelLabel: c.channelLabel, leads: filteredLeads })}
                    style={{ background: '#fff', borderRadius: 14, padding: '20px 20px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: `1px solid ${c.color}18`, cursor: c.value > 0 ? 'pointer' : 'default', transition: 'all 0.18s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${c.color}28`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${c.color}, ${c.color}99)`, borderRadius: '14px 14px 0 0' }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{c.icon}</div>
                      <span style={{ fontSize: 11, color: '#fff', background: c.color, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Meta: {c.goal}</span>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: c.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 10 }}>{c.label}</div>
                    <ProgressBar value={c.value} max={c.goal} color={c.color} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: c.value >= c.goal && c.goal > 0 ? c.color : '#94a3b8', fontWeight: c.value >= c.goal ? 700 : 400 }}>
                        {c.goal > 0 ? `${Math.round((c.value / c.goal) * 100)}%` : '—'}{c.value >= c.goal && c.goal > 0 ? ' ✅ Meta!' : ' da meta'}
                      </span>
                      {c.value > 0 && <span style={{ fontSize: 10, color: c.color, fontWeight: 700 }}>Ver leads →</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal de leads do dia por canal */}
            {dayModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setDayModal(null)}>
                <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>📋 Leads prospectados — {dayModal.channelLabel}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{new Date(dayModal.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
                    </div>
                    <button onClick={() => setDayModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
                    {dayModal.leads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Nenhum lead encontrado para este canal neste dia.</div>
                    ) : dayModal.leads.map((l: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1a56db', flexShrink: 0 }}>
                          {(l.name || l.company || '?')[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name || '—'}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{l.company} {l.role ? `· ${l.role}` : ''}</div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                            {l.email && <span style={{ fontSize: 11, color: '#94a3b8' }}>✉ {l.email}</span>}
                            {l.phone && <span style={{ fontSize: 11, color: '#0066ff', fontWeight: 500 }}>📞 {l.phone}</span>}
                            {l.whatsapp && l.whatsapp !== l.phone && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>💬 {l.whatsapp}</span>}
                            {l.linkedin && (
                              <a href={l.linkedin.startsWith('http') ? l.linkedin : `https://linkedin.com/in/${l.linkedin}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0a66c2', fontWeight: 600, textDecoration: 'none' }}>💼 LinkedIn</a>
                            )}
                            {!l.linkedin && l.name && (
                              <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((l.name || '') + ' ' + (l.company || ''))}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>🔍 Buscar LinkedIn</a>
                            )}
                          </div>
                          {l.channels && l.channels.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {l.channels.map((ch: string) => (
                                <span key={ch} style={{ fontSize: 10, background: ch === 'whatsapp' ? '#f0fdf4' : ch === 'email' ? '#eff6ff' : ch === 'call' ? '#fff7ed' : '#f5f3ff', color: ch === 'whatsapp' ? '#16a34a' : ch === 'email' ? '#1a56db' : ch === 'call' ? '#ea580c' : '#7c3aed', borderRadius: 5, padding: '2px 7px', fontWeight: 500 }}>
                                  {ch === 'whatsapp' ? '💬 WhatsApp' : ch === 'email' ? '✉ E-mail' : ch === 'call' ? '📞 Ligação' : '💼 LinkedIn'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{l.time || ''}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
                    {dayModal.leads.length} lead(s) encontrado(s)
                  </div>
                </div>
              </div>
            )}

            {/* Metas + Histórico */}
            <div className="gestor-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 24 }}>
              {/* Metas */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e8edf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>🎯 Metas Diárias</span>
                  <button onClick={() => setEditGoals(!editGoals)} style={{ background: editGoals ? '#fee2e2' : '#eff6ff', color: editGoals ? '#dc2626' : '#1a56db', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
                    {editGoals ? 'Cancelar' : '✏️ Editar'}
                  </button>
                </div>
                {editGoals ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { key: 'whatsapp_goal', label: '💬 WhatsApp', color: '#16a34a' },
                      { key: 'email_goal', label: '✉ E-mail', color: '#1a56db' },
                      { key: 'call_goal', label: '📞 Ligações', color: '#ea580c' },
                      { key: 'total_goal', label: '🎯 Total', color: '#7c3aed' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>{f.label}</label>
                        <input type="number" min={0} max={200} value={(goalDraft as any)[f.key]}
                          onChange={e => setGoalDraft({ ...goalDraft, [f.key]: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%', border: `1px solid ${f.color}44`, borderRadius: 8, padding: '6px 10px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                    <button onClick={saveGoals} disabled={savingGoals} style={{ background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                      {savingGoals ? 'Salvando...' : '💾 Salvar Metas'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: '💬 WhatsApp', value: goals.whatsapp_goal, color: '#16a34a' },
                      { label: '✉ E-mail', value: goals.email_goal, color: '#1a56db' },
                      { label: '📞 Ligações', value: goals.call_goal, color: '#ea580c' },
                      { label: '🎯 Total', value: goals.total_goal, color: '#7c3aed' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#374151' }}>{f.label}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: f.color }}>{f.value}/dia</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Histórico por dia */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e8edf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>📅 Histórico de Prospecção</span>
                  <select value={period} onChange={e => setPeriod(parseInt(e.target.value))}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 12, outline: 'none' }}>
                    <option value={7}>Últimos 7 dias</option>
                    <option value={14}>Últimos 14 dias</option>
                    <option value={30}>Últimos 30 dias</option>
                    <option value={90}>Últimos 90 dias</option>
                  </select>
                </div>
                {stats.days?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30, fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                    <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Nenhuma atividade registrada ainda</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>O histórico será preenchido automaticamente conforme o Danilo registrar atividades no CRM (WhatsApp, e-mail, ligações e LinkedIn).</div>
                  </div>
                ) : (
                  <div style={{ overflowY: 'auto', maxHeight: 280 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Data</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#16a34a' }}>💬</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#1a56db' }}>✉</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#ea580c' }}>📞</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#7c3aed' }}>Total</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#64748b' }}>Meta %</th>
                          <th style={{ textAlign: 'center', padding: '6px 8px', color: '#64748b' }}>Detalhe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...stats.days].reverse().map((d: any) => {
                          const pct = goals.total_goal > 0 ? Math.round((d.total / goals.total_goal) * 100) : 0;
                          const isToday = d.date === todayKey;
                          return (
                            <tr key={d.date} style={{ borderBottom: '1px solid #f8fafc', background: isToday ? '#eff6ff' : 'transparent' }}>
                              <td style={{ padding: '7px 8px', fontWeight: isToday ? 700 : 400, color: isToday ? '#1a56db' : '#374151' }}>
                                {isToday ? '📍 Hoje' : new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' })}
                              </td>
                              <td style={{ textAlign: 'center', padding: '7px 8px', color: '#16a34a', fontWeight: 600 }}>{d.whatsapp}</td>
                              <td style={{ textAlign: 'center', padding: '7px 8px', color: '#1a56db', fontWeight: 600 }}>{d.email}</td>
                              <td style={{ textAlign: 'center', padding: '7px 8px', color: '#ea580c', fontWeight: 600 }}>{d.call}</td>
                              <td style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 700 }}>{d.total}</td>
                              <td style={{ textAlign: 'center', padding: '7px 8px' }}>
                                <span style={{ background: pct >= 100 ? '#dcfce7' : pct >= 50 ? '#fef9c3' : '#fee2e2', color: pct >= 100 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                  {pct}%
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', padding: '7px 8px' }}>
                                <button onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
                                  style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                                  {selectedDay === d.date ? '▲ Fechar' : '▼ Ver leads'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Totais */}
                {stats.days?.length > 0 && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span>💬 <strong>{stats.totals?.whatsapp}</strong> WhatsApp</span>
                    <span>✉ <strong>{stats.totals?.email}</strong> E-mails</span>
                    <span>📞 <strong>{stats.totals?.call}</strong> Ligações</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700 }}>🎯 Total: <strong>{stats.totals?.total}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalhe do dia selecionado */}
            {selectedDay && selectedData && (
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                  📋 Leads prospectados em {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </div>
                {selectedData.leads?.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 14 }}>Nenhum lead registrado neste dia</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedData.leads.map((lead: any) => {
                      const channelColors: Record<string, { bg: string; color: string; label: string }> = {
                        whatsapp: { bg: '#dcfce7', color: '#16a34a', label: '💬 WhatsApp' },
                        email: { bg: '#dbeafe', color: '#1d4ed8', label: '✉ E-mail' },
                        call: { bg: '#ffedd5', color: '#ea580c', label: '📞 Ligação' },
                        linkedin: { bg: '#dbeafe', color: '#0077b5', label: '💼 LinkedIn' },
                      };
                      const channels = lead.channels || [lead.type];
                      const nextCall = lead.next_call_at ? new Date(lead.next_call_at) : null;
                      const isOverdue = nextCall && nextCall < new Date();
                      const isToday = nextCall && nextCall.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={lead.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, fontSize: 14 }}>{lead.name || '(sem nome)'}</span>
                              {lead.role && <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '1px 8px' }}>{lead.role}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#0066ff', fontWeight: 600, marginTop: 2 }}>{lead.company}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                              {channels.map((ch: string) => {
                                const c = channelColors[ch] || { bg: '#f1f5f9', color: '#374151', label: ch };
                                return <span key={ch} style={{ fontSize: 11, background: c.bg, color: c.color, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{c.label}</span>;
                              })}
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(lead.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {lead.result && lead.result.length > 5 && (
                              <div style={{ fontSize: 11, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>Resultado: {lead.result.replace(/^Ligação: /, '').replace(/^LinkedIn: /, '')}</div>
                            )}
                            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                              {lead.email && <a href={`mailto:${lead.email}`} style={{ fontSize: 11, color: '#1d4ed8', textDecoration: 'none' }}>✉ {lead.email}</a>}
                              {lead.phone && <a href={`tel:${lead.phone}`} style={{ fontSize: 11, color: '#0066ff', fontWeight: 600, textDecoration: 'none' }}>📞 {lead.phone}</a>}
                              {lead.whatsapp && lead.whatsapp !== lead.phone && <a href={`https://wa.me/55${lead.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>💬 {lead.whatsapp}</a>}
                              {lead.linkedin ? (
                                <a href={lead.linkedin.startsWith('http') ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0a66c2', fontWeight: 600, textDecoration: 'none' }}>💼 LinkedIn</a>
                              ) : lead.name ? (
                                <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((lead.name || '') + ' ' + (lead.company || ''))}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none' }}>🔍 Buscar LinkedIn</a>
                              ) : null}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 120 }}>
                            {nextCall ? (
                              <div style={{ background: isOverdue ? '#fef2f2' : isToday ? '#fff7ed' : '#f0fdf4', borderRadius: 8, padding: '6px 10px', border: `1px solid ${isOverdue ? '#fca5a5' : isToday ? '#fcd34d' : '#86efac'}` }}>
                                <div style={{ fontSize: 10, color: isOverdue ? '#dc2626' : isToday ? '#b45309' : '#16a34a', fontWeight: 700 }}>
                                  {isOverdue ? '⚠ Atrasado' : isToday ? '🔔 Hoje' : '📅 Próxima ligação'}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 2 }}>
                                  {nextCall.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>Sem retorno agendado</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Sugestões do Gestor */}
            <div className="gestor-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Enviar sugestão */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e8edf2' }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>💡 Enviar Sugestão / Orientação para Danilo</div>
                <textarea
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Ex: Foque hoje nos leads de Qualificação. Priorize empresas do RS..."
                  rows={5}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <select value={priority} onChange={e => setPriority(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', flex: 1 }}>
                    <option value="normal">📌 Normal</option>
                    <option value="high">🔴 Urgente</option>
                    <option value="low">🟢 Informativo</option>
                  </select>
                  <button onClick={sendSuggestion} disabled={sending || !newMsg.trim()}
                    style={{ background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, opacity: sending || !newMsg.trim() ? 0.6 : 1 }}>
                    {sending ? 'Enviando...' : '📤 Enviar'}
                  </button>
                </div>
              </div>

              {/* Histórico de sugestões */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e8edf2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>
                    📬 Sugestões Enviadas
                    {unreadSuggestions > 0 && (
                      <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, marginLeft: 8 }}>
                        {unreadSuggestions} não lidas
                      </span>
                    )}
                  </span>
                </div>
                {suggestions.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 20 }}>Nenhuma sugestão enviada ainda</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                    {suggestions.map((s: any) => (
                      <div key={s.id} style={{ background: s.read_at ? '#f8fafc' : '#fffbeb', border: `1px solid ${s.priority === 'high' ? '#fca5a5' : s.priority === 'low' ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: s.priority === 'high' ? '#dc2626' : s.priority === 'low' ? '#16a34a' : '#374151' }}>
                            {s.priority === 'high' ? '🔴 Urgente' : s.priority === 'low' ? '🟢 Informativo' : '📌 Normal'}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                            {new Date(parseInt(s.created_at)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {s.read_at ? (
                            <span style={{ fontSize: 11, color: '#16a34a' }}>✅ Lida</span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⏳ Não lida</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{s.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Resumo do período */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginTop: 20, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0066ff, #0044cc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Resumo dos últimos {period} dias</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Consolidado de atividades de prospecção</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Dias com atividade', value: stats.days?.length || 0, icon: '📅', color: '#0066ff' },
                  { label: 'Total WhatsApp', value: stats.totals?.whatsapp || 0, icon: '💬', color: '#16a34a' },
                  { label: 'Total E-mails', value: stats.totals?.email || 0, icon: '✉', color: '#1a56db' },
                  { label: 'Total Ligações', value: stats.totals?.call || 0, icon: '📞', color: '#ea580c' },
                  { label: 'Total LinkedIn', value: stats.totals?.linkedin || 0, icon: '💼', color: '#0a66c2' },
                  { label: 'Total Prospecções', value: stats.totals?.total || 0, icon: '🎯', color: '#7c3aed' },
                  { label: 'Média diária', value: stats.days?.length > 0 ? Math.round((stats.totals?.total || 0) / stats.days.length) : 0, icon: '📈', color: '#0891b2' },
                ].map(c => (
                  <div key={c.label} style={{ background: `${c.color}08`, borderRadius: 12, padding: '14px 16px', border: `1px solid ${c.color}18`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color, borderRadius: '12px 12px 0 0', opacity: 0.6 }} />
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: c.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          {/* Seção: Lista Completa de Leads */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginTop: 20, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span>👥 Todos os Leads ({leads.length})</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all','Prospecção','Qualificação','Apresentação','Pós-venda'].map(f => (
                  <button key={f} onClick={() => setLeadsFilter(f)}
                    style={{ background: leadsFilter === f ? '#0066ff' : '#f1f5f9', color: leadsFilter === f ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: leadsFilter === f ? 600 : 400 }}>
                    {f === 'all' ? 'Todos' : f}
                  </button>
                ))}
              </div>
            </div>
            <input
              placeholder="🔍 Buscar por nome, empresa ou e-mail..."
              value={leadsSearch}
              onChange={e => setLeadsSearch(e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {leads
                .filter(l => leadsFilter === 'all' || l.status === leadsFilter)
                .filter(l => !leadsSearch || `${l.name} ${l.company} ${l.email}`.toLowerCase().includes(leadsSearch.toLowerCase()))
                .slice(0, 100)
                .map((l: any) => {
                  const timeline = (() => { try { return JSON.parse(l.notes || '[]'); } catch { return []; } })();
                  const lastActivity = timeline.length > 0 ? timeline[timeline.length - 1] : null;
                  const nextCall = l.next_call_at ? new Date(l.next_call_at) : null;
                  const isOverdue = nextCall && nextCall < new Date();
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#1a56db', flexShrink: 0 }}>
                        {(l.name || l.company || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{l.name || '—'}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{l.company}</span>
                          <span style={{ fontSize: 11, background: l.status === 'Prospecção' ? '#eff6ff' : l.status === 'Qualificação' ? '#f0fdf4' : '#fff7ed', color: l.status === 'Prospecção' ? '#1a56db' : l.status === 'Qualificação' ? '#16a34a' : '#ea580c', borderRadius: 6, padding: '1px 8px' }}>{l.status}</span>
                          {nextCall && <span style={{ fontSize: 11, background: isOverdue ? '#fee2e2' : '#fef9c3', color: isOverdue ? '#dc2626' : '#92400e', borderRadius: 6, padding: '1px 8px' }}>{isOverdue ? '⚠ Retorno atrasado' : `🔔 Retorno: ${nextCall.toLocaleDateString('pt-BR')}`}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{l.email} {l.phone ? `· ${l.phone}` : ''}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          {l.linkedin ? (
                            <a href={l.linkedin.startsWith('http') ? l.linkedin : `https://linkedin.com/in/${l.linkedin}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0a66c2', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>💼 Ver LinkedIn</a>
                          ) : (
                            <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((l.name || '') + ' ' + (l.company || ''))}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>🔍 Buscar no LinkedIn</a>
                          )}
                        </div>
                        {lastActivity && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Último contato: {lastActivity.type || lastActivity.action} — {new Date(lastActivity.date || lastActivity.ts).toLocaleDateString('pt-BR')}</div>}
                        {l.gestor_note && <div style={{ fontSize: 12, background: '#fef9c3', color: '#92400e', borderRadius: 6, padding: '4px 8px', marginTop: 4 }}>💡 Nota do gestor: {l.gestor_note}</div>}
                      </div>
                      <button
                        onClick={() => { setCommentLead(l); setCommentText(l.gestor_note || ''); }}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >✏️ Comentar</button>
                    </div>
                  );
                })}
              {leads.filter(l => leadsFilter === 'all' || l.status === leadsFilter).filter(l => !leadsSearch || `${l.name} ${l.company} ${l.email}`.toLowerCase().includes(leadsSearch.toLowerCase())).length > 100 && (
                <div style={{ textAlign: 'center', padding: 12, color: '#64748b', fontSize: 12 }}>Mostrando os primeiros 100 resultados. Use a busca para filtrar.</div>
              )}
            </div>
          </div>

          {/* Modal de comentário do gestor */}
          {commentLead && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setCommentLead(null)}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e8edf2' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✏️ Comentário do Gestor</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{commentLead.name} — {commentLead.company}</div>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Ex: Ligar amanhã cedo, tem interesse em TMS. Falar sobre integração com ERP."
                  rows={4}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setCommentLead(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                  <button
                    disabled={savingComment}
                    onClick={async () => {
                      setSavingComment(true);
                      const updated = { ...commentLead, gestor_note: commentText };
                      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
                      // Enviar sugestão para o Danilo se tiver texto
                      if (commentText.trim()) {
                        await fetch('/api/gestor-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: WORKSPACE, message: `💡 Nota sobre ${commentLead.name} (${commentLead.company}): ${commentText}`, from_name: 'Vandir', priority: 'normal' }) });
                      }
                      setSavingComment(false);
                      setCommentLead(null);
                      showToast('✅ Comentário salvo! Danilo será notificado.');
                      load();
                    }}
                    style={{ flex: 2, background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >{savingComment ? 'Salvando...' : '💾 Salvar Comentário'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Seção: Cadastrar Lead Pendente */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginTop: 20, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>➕ Cadastrar Lead para Prospecção Futura</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Vandir pode adicionar leads que ficarão na fila para qualquer usuário prospectar futuramente.</div>

            {/* Busca automática por CNPJ ou nome */}
            <GestorBuscaEmpresa onPreencher={(data: any) => {
              setNewPendingLead(p => ({
                ...p,
                company: data.nome_fantasia || data.razao_social || p.company,
                phone: data.telefone || p.phone,
                email: data.email || p.email,
                note: [
                  p.note || '',
                  `CNPJ: ${data.cnpj}`,
                  data.razao_social ? `Razão Social: ${data.razao_social}` : '',
                  data.atividade_principal ? `Atividade: ${data.atividade_principal}` : '',
                  data.municipio ? `Cidade: ${data.municipio}/${data.uf}` : '',
                  data.porte ? `Porte: ${data.porte}` : '',
                  data.socios?.length > 0 ? `Sócios: ${data.socios.map((s: any) => s.nome).join(', ')}` : ''
                ].filter(Boolean).join(' | ').trim()
              }));
            }} />

            <div className="gestor-lead-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
              {[{key:'name',label:'Nome do Contato',ph:'Ex: João Silva'},{key:'company',label:'Empresa',ph:'Ex: Gestamp'},{key:'phone',label:'Telefone',ph:'Ex: (41) 99999-0000'},{key:'email',label:'E-mail',ph:'Ex: joao@empresa.com'},{key:'note',label:'Observação / Instrução',ph:'Ex: Ligar segunda-feira, tem interesse em TMS'}].map(f => (
                <div key={f.key} style={{ gridColumn: f.key === 'note' ? 'span 3' : undefined }}>
                  <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    placeholder={f.ph}
                    value={(newPendingLead as any)[f.key]}
                    onChange={e => setNewPendingLead({ ...newPendingLead, [f.key]: e.target.value })}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <button
              disabled={addingPending || !newPendingLead.name.trim()}
              onClick={async () => {
                setAddingPending(true);
                const lead = { id: `lead_${Date.now()}`, workspace: WORKSPACE, name: newPendingLead.name, company: newPendingLead.company, phone: newPendingLead.phone, email: newPendingLead.email, status: 'Prospecção', gestor_note: newPendingLead.note, notes: '[]', created_at: new Date().toISOString() };
                await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
                if (newPendingLead.note) {
                  await fetch('/api/gestor-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: WORKSPACE, message: `🆕 Lead cadastrado pelo gestor: ${newPendingLead.name} (${newPendingLead.company}) — ${newPendingLead.note}`, from_name: 'Vandir', priority: 'high' }) });
                }
                setNewPendingLead({ name: '', company: '', phone: '', email: '', note: '' });
                setAddingPending(false);
                showToast('✅ Lead cadastrado! Aparecerá na lista do Danilo Cabral.');
                load();
              }}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >{addingPending ? 'Cadastrando...' : '➕ Cadastrar Lead'}</button>
          </div>

          {/* Seção: LinkedIn Prospecting */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginTop: 20, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                💼 Prospecção LinkedIn
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>— {leads.filter(l => l.linkedin).length} leads com LinkedIn cadastrado</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{k:'with_li',l:'💼 Com LinkedIn'},{k:'without_li',l:'🔍 Sem LinkedIn'},{k:'all',l:'Todos'}].map(f => (
                  <button key={f.k} onClick={() => setLiFilter(f.k as any)}
                    style={{ background: liFilter === f.k ? '#0a66c2' : '#f1f5f9', color: liFilter === f.k ? '#fff' : '#374151', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: liFilter === f.k ? 600 : 400 }}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
            <input
              placeholder="🔍 Buscar por nome ou empresa..."
              value={liSearch}
              onChange={e => setLiSearch(e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {leads
                .filter(l => liFilter === 'with_li' ? !!l.linkedin : liFilter === 'without_li' ? !l.linkedin : true)
                .filter(l => !liSearch || `${l.name} ${l.company}`.toLowerCase().includes(liSearch.toLowerCase()))
                .slice(0, 80)
                .map((l: any) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: l.linkedin ? '#dbeafe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: l.linkedin ? '#1d4ed8' : '#94a3b8', flexShrink: 0 }}>
                      {(l.name || l.company || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name || '—'} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{l.company}</span></div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.role || l.status}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {l.linkedin ? (
                        <>
                          <a href={l.linkedin.startsWith('http') ? l.linkedin : `https://linkedin.com/in/${l.linkedin}`} target="_blank" rel="noreferrer"
                            style={{ background: '#0a66c2', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            👤 Ver Perfil
                          </a>
                          <a href={`https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(l.linkedin.replace(/.*linkedin\.com\/in\//,'').replace(/\//,''))}`} target="_blank" rel="noreferrer"
                            style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ✉ Mensagem
                          </a>
                          <button onClick={() => { setLiMsgLead(l); setLiMsg(`Olá ${(l.name||'').split(' ')[0]}, tudo bem? Vi que você atua na área de logística na ${l.company}. Tenho uma solução de TMS que pode otimizar sua operação. Posso te mostrar em 15 minutos?`); }}
                            style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            📝 Sugerir Msg
                          </button>
                        </>
                      ) : (
                        <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((l.name||'') + ' ' + (l.company||''))}`} target="_blank" rel="noreferrer"
                          style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          🔍 Buscar no LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              {leads.filter(l => liFilter === 'with_li' ? !!l.linkedin : liFilter === 'without_li' ? !l.linkedin : true).filter(l => !liSearch || `${l.name} ${l.company}`.toLowerCase().includes(liSearch.toLowerCase())).length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 13 }}>Nenhum lead encontrado</div>
              )}
            </div>
          </div>

          {/* Modal de sugestão de mensagem LinkedIn */}
          {liMsgLead && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setLiMsgLead(null)}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e8edf2' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✉ Sugestão de Mensagem LinkedIn</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{liMsgLead.name} — {liMsgLead.company}</div>
                <textarea
                  value={liMsg}
                  onChange={e => setLiMsg(e.target.value)}
                  rows={6}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setLiMsgLead(null)} style={{ flex: 1, background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
                  <button onClick={() => { navigator.clipboard.writeText(liMsg); showToast('✅ Mensagem copiada! Cole no LinkedIn.'); }}
                    style={{ flex: 1, background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📋 Copiar Mensagem</button>
                  <a href={liMsgLead.linkedin?.startsWith('http') ? liMsgLead.linkedin : `https://linkedin.com/in/${liMsgLead.linkedin}`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, background: '#0a66c2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💼 Abrir LinkedIn</a>
                </div>
              </div>
            </div>
          )}

          {/* Seção: Leads Prioritários */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginTop: 20, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎯 Marcar Lead Prioritário
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>— Vandir pode indicar leads que o Danilo deve contatar hoje</span>
            </div>
            <div className="gestor-priority-row" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                id="priority-lead-name"
                placeholder="Nome do lead ou empresa (ex: Gestamp, Stihl, Marcos Miranda...)"
                style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
              />
              <input
                id="priority-lead-reason"
                placeholder="Motivo / instrução (ex: Ligar hoje, tem interesse!)"
                style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}
              />
              <button
                onClick={async () => {
                  const nameEl = document.getElementById('priority-lead-name') as HTMLInputElement;
                  const reasonEl = document.getElementById('priority-lead-reason') as HTMLInputElement;
                  const name = nameEl?.value?.trim();
                  const reason = reasonEl?.value?.trim();
                  if (!name) return;
                  const msg = `🎯 LEAD PRIORITÁRIO: ${name}${reason ? ` — ${reason}` : ' — Entre em contato hoje!'}`;
                  await fetch('/api/gestor-suggestions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspace: WORKSPACE, message: msg, from_name: 'Vandir', priority: 'high' }),
                  });
                  if (nameEl) nameEl.value = '';
                  if (reasonEl) reasonEl.value = '';
                  showToast('✅ Lead prioritário marcado! Danilo receberá o alerta.');
                  load();
                }}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                🔴 Marcar como Prioritário
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>O Danilo verá um alerta vermelho urgente no CRM com o nome do lead e a instrução.</div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

// ── Componente de Busca de Empresa por CNPJ/Nome ──────────────────────────────
function GestorBuscaEmpresa({ onPreencher }: { onPreencher: (data: any) => void }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [filled, setFilled] = useState<any>(null);

  const buscar = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setFilled(null);
    try {
      const isCnpj = query.replace(/\D/g, '').length === 14;
      const url = isCnpj
        ? `/api/busca-empresa?cnpj=${query.replace(/\D/g, '')}`
        : `/api/busca-empresa?nome=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (isCnpj && data.cnpj) {
        setFilled(data);
        onPreencher(data);
      } else if (data.results?.length > 0) {
        setResults(data.results);
      } else if (data.suggestion) {
        if (window.confirm(`${data.message}\n\nClicar em OK para abrir o Google.`)) {
          window.open(data.googleUrl, '_blank');
        }
      } else {
        alert(data.message || data.error || 'Nenhuma empresa encontrada. Tente buscar pelo CNPJ.');
      }
    } catch {
      alert('Erro ao buscar empresa.');
    } finally {
      setSearching(false);
    }
  };

  const selecionar = (data: any) => {
    setFilled(data);
    setResults([]);
    onPreencher(data);
  };

  return (
    <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', marginBottom: 4 }}>🔍 Buscar empresa por CNPJ ou Nome — preenchimento automático</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Digite o CNPJ (14 dígitos) <strong>ou o nome da empresa</strong> e pressione Enter</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, border: '1px solid #bfdbfe', borderRadius: 8, padding: '7px 10px', fontSize: 13, boxSizing: 'border-box' as const }}
          placeholder="CNPJ (60.701.190/0001-04) ou nome da empresa..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
        />
        <button
          onClick={buscar}
          disabled={searching}
          style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' as const }}
        >
          {searching ? '⏳' : '🔍 Buscar'}
        </button>
      </div>
      {results.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' as const, border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }}>
          {results.map((r, i) => (
            <div key={i}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
              onClick={() => selecionar(r)}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <div style={{ fontWeight: 600 }}>{r.nome_fantasia || r.razao_social}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>{r.cnpj} · {r.municipio}/{r.uf} · {r.atividade_principal?.slice(0, 50)}</div>
            </div>
          ))}
        </div>
      )}
      {filled && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
          ✅ Dados preenchidos: {filled.razao_social} ({filled.municipio}/{filled.uf})
        </div>
      )}
    </div>
  );
}
