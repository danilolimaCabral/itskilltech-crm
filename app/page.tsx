'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { TemplatesView, BIView } from './templates-bi-views';
import { AgentView } from './agent-view';

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
// Funil de vendas — 5 etapas
const FUNNEL = [
  { id: 'prospeccao',   label: '1 · Prospecção',   short: 'Prospecção',   color: '#6366f1', bg: '#eef2ff' },
  { id: 'qualificacao', label: '2 · Qualificação',  short: 'Qualificação', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'email_aberto', label: '📬 E-mail Aberto',  short: 'E-mail Aberto', color: '#0891b2', bg: '#ecfeff' },
  { id: 'apresentacao', label: '3 · Apresentação',  short: 'Apresentação', color: '#3b82f6', bg: '#eff6ff' },
  { id: 'fechamento',   label: '4 · Fechamento',   short: 'Fechamento',   color: '#10b981', bg: '#ecfdf5' },
  { id: 'posvenda',     label: '5 · Pós-venda',    short: 'Pós-venda',    color: '#8b5cf6', bg: '#f5f3ff' },
];
const FUNNEL_MAP: any = Object.fromEntries(FUNNEL.map(f => [f.id, f]));
// Mapeamento de status legado para novo funil
const LEGACY_MAP: any = { novo: 'prospeccao', contatado: 'qualificacao', negociacao: 'apresentacao', fechado: 'fechamento', perdido: 'prospeccao' };
const normalizeStatus = (s: string) => FUNNEL_MAP[s] ? s : (LEGACY_MAP[s] || 'prospeccao');
const statusLabel = (s: string) => FUNNEL_MAP[normalizeStatus(s)]?.short || s;

const Icon = ({ d, fill, size, color }: { d: string; fill?: boolean; size?: number; color?: string }) => (
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
  template: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  bi: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  sparkles: '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
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
  const [wsListOpen, setWsListOpen] = useState(false);
  const [wsPassModal, setWsPassModal] = useState<string | null>(null); // workspace id a trocar
  const [wsPassInput, setWsPassInput] = useState('');
  const WS_PASSWORD = 'lottus2025';
  const [enriching, setEnriching] = useState<string | null>(null);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });
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
  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [showWhatsTemplates, setShowWhatsTemplates] = useState(false);
  const [whatsModal, setWhatsModal] = useState<Lead | null>(null);
  const [whatsBody, setWhatsBody] = useState('');
  const [sendingWhats, setSendingWhats] = useState(false);
  const [zapiConfigured, setZapiConfigured] = useState(false);
  // Painel lateral de lead
  const [leadPanel, setLeadPanel] = useState<Lead | null>(null);
  const [panelAnalysis, setPanelAnalysis] = useState<any>(null);
  const [analyzingLead, setAnalyzingLead] = useState(false);
  const [panelTab, setPanelTab] = useState<'info' | 'timeline' | 'analysis'>('info');
  // Seleção em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  // Modal de observações
  const [noteModal, setNoteModal] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  // Modal de agendamento Google Calendar
  const [calModal, setCalModal] = useState<Lead | null>(null);
  const [calDate, setCalDate] = useState('');
  const [calGuestEmail, setCalGuestEmail] = useState('');
  const [calTitle, setCalTitle] = useState('');
  const [calDescription, setCalDescription] = useState('');
  const [calSlots, setCalSlots] = useState<Array<{time: string; available: boolean}>>([]);
  const [calSelectedSlot, setCalSelectedSlot] = useState('');
  const [calLoadingSlots, setCalLoadingSlots] = useState(false);
  const [calSaving, setCalSaving] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  // Envio em massa para leads selecionados
  const sendBulkEmails = async (leadsToSend: Lead[]) => {
    const withEmail = leadsToSend.filter(l => l.email);
    if (!withEmail.length) { showToast('Nenhum lead selecionado tem e-mail'); return; }
    if (!confirm(`Enviar e-mail para ${withEmail.length} lead(s) selecionado(s)?`)) return;
    setBulkSending(true);
    setBulkProgress({ done: 0, total: withEmail.length });
    let sent = 0, failed = 0;
    for (const lead of withEmail) {
      try {
        const wsName = ws?.name || 'getLOG/Lottustech';
        const emailTpl = templates.find(t => t.type === 'email');
        let subject = `Apresentação ${wsName} — Solução TMS para ${lead.company || 'sua empresa'}`;
        let body = `Olá ${lead.name.split(' ')[0]},\n\nTudo bem?\n\nMeu nome é Danilo, da ${wsName}. Vi que você é ${lead.role || 'decisor'} na ${lead.company || 'sua empresa'} e acredito que nossa solução de TMS pode otimizar significativamente a operação logística de vocês.\n\nGostaria de agendar uma conversa rápida de 15 minutos para apresentar os resultados que estamos gerando para empresas do mesmo segmento.\n\nQual seria o melhor horário para você?\n\nAtenciosamente,\nDanilo Cabral\n${wsName}\ndanilo@lottustech.com.br\n(41) 99949-9815`;
        if (emailTpl) {
          subject = (emailTpl.subject || subject).replace(/\{\{nome\}\}/g, lead.name.split(' ')[0]).replace(/\{\{empresa\}\}/g, lead.company || 'sua empresa').replace(/\{\{cargo\}\}/g, lead.role || 'decisor');
          body = emailTpl.body.replace(/\{\{nome\}\}/g, lead.name.split(' ')[0]).replace(/\{\{empresa\}\}/g, lead.company || 'sua empresa').replace(/\{\{cargo\}\}/g, lead.role || 'decisor');
        }
        const r = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: lead.email, toName: lead.name, subject, body, workspaceSlug: workspace, fromName: ws?.name, leadId: lead.id }),
        });
        const j = await r.json();
        if (j.success) {
          sent++;
          const STATUS_ADVANCE: any = { prospeccao: 'qualificacao', novo: 'qualificacao', contatado: 'qualificacao' };
          const nextStatus = STATUS_ADVANCE[normalizeStatus(lead.status)] || normalizeStatus(lead.status);
          const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
          timeline.unshift({ type: 'email', label: `E-mail enviado: ${subject}`, ts: Date.now() });
          if (nextStatus !== normalizeStatus(lead.status)) timeline.unshift({ type: 'status', label: `Etapa → ${FUNNEL_MAP[nextStatus]?.label || nextStatus}`, ts: Date.now() });
          const notesClean = (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
          await saveLead({ ...lead, status: nextStatus, updated_at: Date.now(), notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` });
        } else { failed++; }
      } catch { failed++; }
      setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      await new Promise(r => setTimeout(r, 600)); // delay anti-spam
    }
    setBulkSending(false);
    setSelectedIds(new Set());
    showToast(`✓ ${sent} e-mail(s) enviado(s)${failed ? ` · ${failed} falha(s)` : ''}`);
  };

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
      // load templates
      try {
        const r = await fetch(`/api/templates?workspace=${workspace}`);
        const j = await r.json();
        if (Array.isArray(j)) setTemplates(j);
        else setTemplates([]);
      } catch { setTemplates([]); }
      // check z-api
      try {
        const r = await fetch('/api/whatsapp?action=status');
        const j = await r.json();
        setZapiConfigured(!!j.configured);
      } catch { setZapiConfigured(false); }
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

  const removeLead = async (id: string, skipConfirm?: boolean) => {
    if (!skipConfirm && !confirm('Excluir este lead?')) return;
    if (hasDb) { await fetch(`/api/leads?id=${id}`, { method: 'DELETE' }); await loadLeads(); }
    else { const next = leads.filter(l => l.id !== id); setLeads(next); persistLocal(next); }
    showToast('Lead excluído');
  };

  const enrichLead = async (lead: Lead) => {
    if (!lead.company) { showToast('Lead sem empresa — não é possível enriquecer'); return; }
    setEnriching(lead.id);
    try {
      const r = await fetch('/api/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: lead.company, website: (lead as any).website || '' }) });
      const d = await r.json();
      if (!d.ok) { showToast(d.error || 'Dados não encontrados'); return; }
      // Monta resumo do que foi encontrado
      const found: string[] = [];
      if (d.telefone) found.push(`📞 ${d.telefone}`);
      if (d.email && !d.email_is_guess) found.push(`✉ ${d.email}`);
      if (d.contact_name) found.push(`👤 ${d.contact_name}${d.contact_title ? ` (${d.contact_title})` : ''}`);
      // Atualiza o lead com todos os dados encontrados
      const decisorNote = d.contact_name
        ? `[DECISOR] ${d.contact_name}${d.contact_title ? ` · ${d.contact_title}` : ''}${d.contact_linkedin ? ` · ${d.contact_linkedin}` : ''}\n`
        : '';
      const notesClean = (lead.notes || '').replace(/\[DECISOR\][^\n]*\n?/g, '');
      const timeline = JSON.parse(notesClean.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
      timeline.unshift({ type: 'enrich', label: `Enriquecido via ${d.source}`, ts: Date.now() });
      const notesBase = notesClean.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
      const updated: Lead = {
        ...lead,
        phone: d.telefone || lead.phone || '',
        whatsapp: d.telefone || lead.whatsapp || '',
        email: (!lead.email && d.email && !d.email_is_guess) ? d.email : lead.email,
        notes: decisorNote + notesBase + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`,
        updated_at: Date.now(),
      };
      await saveLead(updated);
      const summary = found.length ? found.join(' · ') : 'sem dados novos';
      showToast(`✓ Enriquecido via ${d.source}: ${summary}`);
    } catch { showToast('Erro ao enriquecer'); }
    setEnriching(null);
  };

  // Registrar ligação e mover lead de status
  const saveCall = async () => {
    if (!callResult || !callModal) return;
    setSavingCall(true);
    const STATUS_MAP: any = {
      atendeu_interesse: 'apresentacao',
      atendeu_sem_interesse: 'qualificacao',
      nao_atendeu: null,
      caixa_postal: null,
      numero_errado: null,
    };
    const newStatus = STATUS_MAP[callResult];
    // Atualizar timeline
    const timeline = JSON.parse(callModal.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
    const resultLabels2: any = { atendeu_interesse: '✅ Atendeu — interesse!', atendeu_sem_interesse: '🟡 Atendeu — sem interesse', nao_atendeu: '❌ Não atendeu', caixa_postal: '📬 Caixa postal', numero_errado: '🚫 Número errado' };
    timeline.unshift({ type: 'call', label: `Ligação: ${resultLabels2[callResult] || callResult}`, note: callNotes || '', ts: Date.now() });
    if (newStatus) timeline.unshift({ type: 'status', label: `Etapa → ${FUNNEL_MAP[newStatus]?.label || newStatus}`, ts: Date.now(), from: callModal.status });
    const notesClean = (callModal.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
    const notesWithCall = callNotes ? `[Ligação ${new Date().toLocaleDateString('pt-BR')}] ${callNotes}\n${notesClean}` : notesClean;
    const updatedLead: Lead = {
      ...callModal,
      status: newStatus || callModal.status,
      call_count: (callModal.call_count || 0) + 1,
      last_contact: Date.now(),
      updated_at: Date.now(),
      notes: notesWithCall + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`,
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
        body: JSON.stringify({ to: emailModal.email, toName: emailModal.name, subject: emailSubject, body: emailBody, workspaceSlug: workspace, fromName: ws?.name, leadId: emailModal.id }),
      });
      const j = await r.json();
      if (j.success) {
        showToast('✓ E-mail enviado para ' + emailModal.email);
        // Avançar para próxima etapa do funil e registrar na timeline
        const STATUS_ADVANCE: any = { prospeccao: 'qualificacao', novo: 'qualificacao', contatado: 'qualificacao', qualificacao: 'apresentacao', apresentacao: 'fechamento', fechamento: 'posvenda' };
        const nextStatus = STATUS_ADVANCE[normalizeStatus(emailModal.status)] || normalizeStatus(emailModal.status);
        const timeline = JSON.parse(emailModal.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
        timeline.unshift({ type: 'email', label: `E-mail enviado: ${emailSubject}`, ts: Date.now() });
        if (nextStatus !== normalizeStatus(emailModal.status)) timeline.unshift({ type: 'status', label: `Etapa → ${FUNNEL_MAP[nextStatus]?.label || nextStatus}`, ts: Date.now() });
        const notesClean = (emailModal.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
        await saveLead({ ...emailModal, status: nextStatus, updated_at: Date.now(), notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` });
        setEmailModal(null); setEmailSubject(''); setEmailBody('');
      } else {
        showToast('Erro: ' + (j.error || 'falha no envio'));
      }
    } catch { showToast('Erro ao enviar e-mail'); }
    setSendingEmail(false);
  };

  const openEmailModal = (lead: Lead) => {
    setEmailModal(lead);
    // Usar primeiro template de email do workspace, se existir
    const emailTpl = templates.find(t => t.type === 'email');
    if (emailTpl) {
      const body = emailTpl.body.replace(/\{\{nome\}\}/g, lead.name.split(' ')[0]).replace(/\{\{empresa\}\}/g, lead.company || 'sua empresa').replace(/\{\{cargo\}\}/g, lead.role || 'decisor');
      setEmailSubject(emailTpl.subject || `Apresentação ${ws?.name || 'getLOG/Lottustech'} — ${lead.company || 'sua empresa'}`);
      setEmailBody(body);
    } else {
      const wsName = ws?.name || 'getLOG/Lottustech';
      setEmailSubject(`Apresentação ${wsName} — Solução TMS para ${lead.company || 'sua empresa'}`);
      setEmailBody(`Olá ${lead.name.split(' ')[0]},\n\nTudo bem?\n\nMeu nome é Danilo Cabral, da ${wsName}. Percebo que empresas ${(lead as any).sector || 'atacadistas e distribuidoras'} como a ${lead.company || 'sua empresa'} buscam constantemente otimizar a operação logística e reduzir custos com frete.\n\nNossa solução de TMS já ajudou clientes a reduzir em até 20% os custos com transporte e melhorar a pontualidade de entregas. Que tal explorar como podemos gerar resultados semelhantes para a ${lead.company || 'sua empresa'}?\n\nMe diga qual o melhor horário para um bate-papo de 15 minutos.\n\nAtenciosamente,\nDanilo Cabral\nGerente Comercial | ${wsName}\ndanilo@lottustech.com.br | (41) 99949-9815\nwww.lottustech.com.br`);
    }
    setShowEmailTemplates(false);
  };

  const openWhatsModal = (lead: Lead) => {
    setWhatsModal(lead);
    const whatsTpl = templates.find(t => t.type === 'whatsapp');
    if (whatsTpl) {
      const body = whatsTpl.body.replace(/\{\{nome\}\}/g, lead.name.split(' ')[0]).replace(/\{\{empresa\}\}/g, lead.company || 'sua empresa').replace(/\{\{cargo\}\}/g, lead.role || 'decisor');
      setWhatsBody(body);
    } else {
      const wsNameW = ws?.name || 'getLOG/Lottustech';
      setWhatsBody(`Olá ${lead.name.split(' ')[0]}, tudo bem? Sou da ${wsNameW}. Percebo que ${(lead as any).sector ? 'empresas do setor de ' + (lead as any).sector : 'atacadistas'} como a ${lead.company || 'sua empresa'} buscam constantemente otimizar custos logísticos. Nossa solução de TMS já ajudou clientes a reduzir em até 20% os custos com transporte e melhorar a pontualidade de entregas. Que tal explorar como podemos gerar resultados semelhantes para a ${lead.company || 'sua empresa'}? Me diga qual o melhor horário para um bate-papo de 15 minutos. — Danilo Cabral | (41) 99949-9815`);
    }
    setShowWhatsTemplates(false);
  };

  // Enviar WhatsApp via Z-API ou abrir no WhatsApp Web
  const sendWhatsApp = async (lead: Lead, message: string, useApi: boolean) => {
    const num = cleanPhone(lead.whatsapp || lead.phone || '');
    if (!num) { showToast('Lead sem número de telefone'); return; }
    if (useApi && zapiConfigured) {
      setSendingWhats(true);
      try {
        const r = await fetch('/api/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: num, message, leadName: lead.name, companyName: lead.company }),
        });
        const j = await r.json();
        if (j.ok) {
          // Registrar na timeline
          const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
          timeline.unshift({ type: 'whatsapp', label: `WhatsApp enviado via Z-API`, ts: Date.now() });
          const notesClean = (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
          await saveLead({ ...lead, updated_at: Date.now(), notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` });
          showToast('✓ WhatsApp enviado via Z-API!');
          setWhatsModal(null);
        } else {
          showToast('Erro Z-API: ' + (j.error || j.message || 'falha'));
        }
      } catch (e: any) { showToast('Erro ao enviar: ' + e.message); }
      setSendingWhats(false);
    } else {
      // Fallback: abrir no WhatsApp Web
      const msg = encodeURIComponent(message);
      window.open(`https://wa.me/55${num}?text=${msg}`, '_blank');
      // Registrar na timeline mesmo assim
      const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
      timeline.unshift({ type: 'whatsapp', label: `WhatsApp aberto no WhatsApp Web`, ts: Date.now() });
      const notesClean = (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
      await saveLead({ ...lead, updated_at: Date.now(), notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` });
      setWhatsModal(null);
    }
  };

  // Analisar empresa
  const analyzeCompany = async (lead: Lead) => {
    if (!lead.company && !lead.notes?.includes('CNPJ:')) { showToast('Lead sem empresa para analisar'); return; }
    setAnalyzingLead(true); setPanelAnalysis(null); setPanelTab('analysis');
    try {
      const cnpjMatch = lead.notes?.match(/CNPJ[:\s]+([\d.\-\/]+)/);
      const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g,'') : '';
      const r = await fetch('/api/analyze-company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: lead.company || lead.name, cnpj, leadName: lead.name, leadRole: lead.role }) });
      const j = await r.json();
      if (j.ok) { setPanelAnalysis(j); showToast('Análise concluída!'); }
      else showToast('Erro na análise: ' + (j.error || 'tente novamente'));
    } catch { showToast('Erro ao analisar empresa'); }
    setAnalyzingLead(false);
  };

  // Mudar status rápido do lead (funil de 5 etapas)
  const quickStatus = async (lead: Lead, newStatus: string) => {
    const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
    const funnelLabel = FUNNEL_MAP[newStatus]?.label || newStatus;
    timeline.unshift({ type: 'status', label: `Etapa → ${funnelLabel}`, ts: Date.now(), from: lead.status });
    const notesClean = (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
    const updated: Lead = { ...lead, status: newStatus, updated_at: Date.now(), notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` };
    await saveLead(updated);
    setLeadPanel(updated);
    showToast(`Etapa: ${FUNNEL_MAP[newStatus]?.short || newStatus}`);
  };

  const loadTemplates = async (ws: string) => {
    try { const r = await fetch(`/api/templates?workspace=${ws}`); const j = await r.json(); if (Array.isArray(j)) setTemplates(j); } catch {}
  };

  const ws = workspaces.find(w => w.id === workspace) || workspaces[0];
  const filtered = leads.filter(l => {
    const t = search.toLowerCase();
    const ms = !t || l.name.toLowerCase().includes(t) || (l.email || '').toLowerCase().includes(t) || (l.company || '').toLowerCase().includes(t);
    return ms && (statusFilter === 'all' || normalizeStatus(l.status) === statusFilter);
  });
  const stats = {
    total: leads.length,
    prospeccao: leads.filter(l => normalizeStatus(l.status) === 'prospeccao').length,
    qualificacao: leads.filter(l => normalizeStatus(l.status) === 'qualificacao').length,
    email_aberto: leads.filter(l => normalizeStatus(l.status) === 'email_aberto').length,
    apresentacao: leads.filter(l => normalizeStatus(l.status) === 'apresentacao').length,
    fechamento: leads.filter(l => normalizeStatus(l.status) === 'fechamento').length,
    posvenda: leads.filter(l => normalizeStatus(l.status) === 'posvenda').length,
    reunioes: leads.filter(l => {
      try {
        const tl = JSON.parse(l.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
        return tl.some((t: any) => t.type === 'meeting');
      } catch { return false; }
    }).length,
  };

  // Extrai todas as reuniões agendadas de todos os leads
  const allMeetings = leads.flatMap(l => {
    try {
      const tl = JSON.parse(l.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
      return tl
        .filter((t: any) => t.type === 'meeting')
        .map((t: any) => ({ ...t, leadName: l.name, leadCompany: l.company, leadId: l.id }));
    } catch { return []; }
  }).sort((a: any, b: any) => b.ts - a.ts);

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header"><div className="logo">IT</div><div className="logo-text">ITskill<span>CRM</span></div></div>
        <div className="sidebar-section">
          {/* Workspace ativo sempre visível */}
          {workspaces.filter(w => w.id === workspace).map(w => (
            <button key={w.id} className="ws-item active"
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-start', cursor: 'default' }}>
              <span className="ws-dot" style={{ background: w.color }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{w.name}</span>
            </button>
          ))}
          {/* Outros workspaces ocultos — acesso via Configurações */}
        </div>
        <div className="sidebar-section">
          <div className="section-label">Navegação</div>
          {[['dashboard', '📊 Dashboard', ICONS.bi], ['leads', 'Leads', ICONS.leads], ['calendar_view', '📅 Calendário', ICONS.calendar], ['search', 'Buscar Leads', ICONS.search2], ['agent', '🤖 Agente IA', ICONS.sparkles], ['templates', 'Templates', ICONS.template], ['bi', 'BI / Prospecção', ICONS.bi], ['sheets', '📊 Google Sheets', ICONS.upload], ['inbox', 'Caixa de Entrada', ICONS.inbox], ['sent', '📤 E-mails Enviados', ICONS.inbox], ['settings', 'Configurações', ICONS.settings]].map(([v, label, ic]) => (
            <button key={v} className={`nav-item${view === v ? ' active' : ''}`} onClick={() => { setView(v as string); setSidebarOpen(false); }}>
              <Icon d={ic as string} /><span>{label}</span>
            </button>
          ))}
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn menu-toggle" onClick={() => setSidebarOpen(true)}><Icon d='<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>' /></button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{ws?.name} <span style={{ color: 'var(--text-muted)' }}>/</span> <strong style={{ color: 'var(--text)' }}>{{ dashboard: 'Dashboard', leads: 'Leads', calendar_view: 'Calendário', search: 'Buscar Leads', agent: 'Agente de Prospecção', templates: 'Templates', bi: 'BI / Prospecção', sheets: 'Google Sheets', inbox: 'Caixa de Entrada', sent: 'E-mails Enviados', workspaces: 'Workspaces', settings: 'Configurações' }[view] || view}</strong></span>
          <span className={`db-badge ${gmailConfigured ? 'on' : 'off'}`}>{gmailConfigured ? '✉ E-mail ativo' : 'E-mail não configurado'}</span>
        </header>

        <div className="content"><div className="content-narrow">
          {view === 'leads' && (
            <>
              <div className="page-header">
                <div><div className="page-title">Leads</div><div className="page-description">{ws?.name} · {leads.length} contato(s)</div></div>
                <div className="page-actions mobile-actions">
                  <button className="btn" style={{background:'#f59e0b',color:'#fff',border:'none',marginRight:8,fontSize:12,padding:'6px 12px',borderRadius:6,cursor:'pointer',opacity:enrichingAll?0.6:1}} disabled={enrichingAll} onClick={async () => {
                    const toEnrich = leads.filter(l => !l.phone && l.company);
                    if (!toEnrich.length) { showToast('Todos os leads já têm telefone!'); return; }
                    setEnrichingAll(true);
                    setEnrichProgress({ done: 0, total: toEnrich.length });
                    let enriched = 0;
                    for (let i = 0; i < toEnrich.length; i++) {
                      const lead = toEnrich[i];
                      try {
                        const r = await fetch('/api/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: lead.company, website: (lead as any).website || '' }) });
                        const data = await r.json();
                        if (data.ok && (data.telefone || data.email)) {
                          enriched++;
                          const decisorNote = data.contact_name
                            ? `[DECISOR] ${data.contact_name}${data.contact_title ? ` · ${data.contact_title}` : ''}${data.contact_linkedin ? ` · ${data.contact_linkedin}` : ''}\n`
                            : '';
                          const notesClean = (lead.notes || '').replace(/\[DECISOR\][^\n]*\n?/g, '');
                          const timeline = JSON.parse(notesClean.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
                          timeline.unshift({ type: 'enrich', label: `Enriquecido via ${data.source}`, ts: Date.now() });
                          const notesBase = notesClean.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
                          const updatedLead = {
                            ...lead,
                            phone: data.telefone || lead.phone || '',
                            whatsapp: data.telefone || lead.whatsapp || '',
                            email: (!lead.email && data.email && !data.email_is_guess) ? data.email : lead.email,
                            notes: decisorNote + notesBase + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`,
                            updated_at: Date.now(),
                          };
                          await saveLead(updatedLead);
                        }
                      } catch {}
                      setEnrichProgress({ done: i + 1, total: toEnrich.length });
                      await new Promise(res => setTimeout(res, 500));
                    }
                    setEnrichingAll(false);
                    showToast(`✓ Enriquecimento concluído: ${enriched}/${toEnrich.length} leads atualizados`);
                  }}>
                    {enrichingAll ? `⚙ Enriquecendo... ${enrichProgress.done}/${enrichProgress.total}` : '⚙ Enriquecer todos'}
                  </button>
                  <button className="btn" style={{background:'#ef4444',color:'#fff',border:'none',marginRight:8,fontSize:12,padding:'6px 12px',borderRadius:6,cursor:'pointer'}} onClick={async () => {
                    const seen = new Map<string, string>();
                    const toDelete: string[] = [];
                    for (const l of [...leads].sort((a,b) => (a.updated_at||0)-(b.updated_at||0))) {
                      const key = (l.email || l.name || '').toLowerCase().trim();
                      if (!key) continue;
                      if (seen.has(key)) { toDelete.push(l.id); } else { seen.set(key, l.id); }
                    }
                    if (!toDelete.length) { showToast('Nenhum duplicado encontrado!'); return; }
                    if (!confirm(`Encontrados ${toDelete.length} lead(s) duplicado(s). Excluir os mais antigos?`)) return;
                    for (const id of toDelete) await removeLead(id, true);
                    showToast(`✓ ${toDelete.length} duplicado(s) removido(s)`);
                  }}>🗑 Deduplicar</button>
                  <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Icon d={ICONS.plus} />Novo lead</button>
                </div>
              </div>
              {/* Funil de vendas — 5 etapas */}
              <div className="stats">
                <div className="stat" style={{ cursor: 'pointer', borderBottom: statusFilter === 'all' ? '3px solid #475467' : '3px solid transparent' }} onClick={() => setStatusFilter('all')}>
                  <div className="stat-label"><span className="stat-dot" style={{ background: '#475467' }} />Total</div><div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat" style={{ cursor: 'pointer', borderBottom: '3px solid #0066ff', background: '#eff6ff' }} onClick={() => setView('calendar_view')}>
                  <div className="stat-label"><span className="stat-dot" style={{ background: '#0066ff' }} />Reuniões</div>
                  <div className="stat-value" style={{ color: '#0066ff' }}>{stats.reunioes}</div>
                </div>
                {FUNNEL.map(f => (
                  <div key={f.id} className="stat" style={{ cursor: 'pointer', borderBottom: statusFilter === f.id ? `3px solid ${f.color}` : '3px solid transparent' }} onClick={() => setStatusFilter(f.id)}>
                    <div className="stat-label"><span className="stat-dot" style={{ background: f.color }} />{f.short}</div>
                    <div className="stat-value" style={{ color: f.color }}>{(stats as any)[f.id] || 0}</div>
                  </div>
                ))}
              </div>
              {/* Label da etapa ativa */}
              {statusFilter !== 'all' && (() => { const f = FUNNEL_MAP[statusFilter]; return f ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 12px', background: f.bg, borderRadius: 8, border: `1px solid ${f.color}33` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: f.color }}>Filtrando: {f.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{filtered.length} lead(s)</span>
                  <button onClick={() => { setStatusFilter('all'); setSelectedIds(new Set()); }} style={{ marginLeft: 'auto', fontSize: 11, color: f.color, background: 'none', border: `1px solid ${f.color}55`, borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>✕ Limpar filtro</button>
                </div>
              ) : null; })()}
              <div className="toolbar" style={{ gap: 8 }}>
                <div className="search"><Icon d='<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                {/* Botões de seleção em massa */}
                {filtered.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => {
                        if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(filtered.map(l => l.id)));
                      }}>
                      {selectedIds.size === filtered.length ? '☑ Desmarcar todos' : '☐ Selecionar todos'}
                    </button>
                    {selectedIds.size > 0 && (<>
                      <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px', background: '#0066ff' }}
                        disabled={bulkSending}
                        onClick={() => sendBulkEmails(filtered.filter(l => selectedIds.has(l.id)))}>
                        {bulkSending
                          ? `Enviando... ${bulkProgress.done}/${bulkProgress.total}`
                          : `✉ E-mail (${selectedIds.size})`}
                      </button>
                      <button className="btn" style={{ fontSize: 11, padding: '5px 12px', background: '#25d366', color: '#fff', border: 'none' }}
                        disabled={bulkSending}
                        onClick={() => {
                          const sel = filtered.filter(l => selectedIds.has(l.id));
                          const withPhone = sel.filter(l => l.whatsapp || l.phone);
                          if (!withPhone.length) { showToast('Nenhum lead selecionado tem WhatsApp/telefone'); return; }
                          if (!confirm(`Enviar WhatsApp para ${withPhone.length} lead(s)?`)) return;
                          withPhone.forEach((lead, i) => {
                            setTimeout(() => {
                              const wsNameW = ws?.name || 'getLOG/Lottustech';
                              const body = encodeURIComponent(`Olá ${lead.name.split(' ')[0]}, tudo bem?

Meu nome é Danilo, da ${wsNameW}. Vi que você é ${lead.role || 'decisor'} na ${lead.company || 'sua empresa'} e acredito que nossa solução de TMS pode otimizar a operação logística de vocês.

Posso te mostrar em 15 minutos como estamos ajudando empresas do mesmo segmento?

Qualquer dúvida, pode me chamar aqui ou pelo (41) 99949-9815.`);
                              const num = (lead.whatsapp || lead.phone || '').replace(/\D/g,'');
                              window.open(`https://wa.me/${num}?text=${body}`, '_blank');
                            }, i * 800);
                          });
                          showToast(`Abrindo WhatsApp para ${withPhone.length} lead(s)...`);
                        }}>
                        💬 WhatsApp ({selectedIds.size})
                      </button>
                      <button className="btn" style={{ fontSize: 11, padding: '5px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        onClick={() => setSelectedIds(new Set())}>
                        ✕ Limpar
                      </button>
                    </>)}
                  </div>
                )}
              </div>
              {filtered.length === 0 ? (
                <div className="empty-state"><div className="empty-title">Nenhum lead</div><div className="empty-text">Adicione seu primeiro contato</div><button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Icon d={ICONS.plus} />Adicionar lead</button></div>
              ) : (
                <>
                <div className="table-wrap"><table className="data"><thead><tr><th style={{width:32, paddingRight:4}}></th><th>Lead</th><th>Contato</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead><tbody>
                  {filtered.map(lead => (
                    <tr key={lead.id} onClick={() => { setLeadPanel(lead); setPanelAnalysis(null); setPanelTab('info'); }}>
                      <td onClick={e => e.stopPropagation()} style={{paddingRight:4, width:32}}>
                        <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={e => { e.stopPropagation(); setSelectedIds(prev => { const n = new Set(prev); if (e.target.checked) n.add(lead.id); else n.delete(lead.id); return n; }); }} style={{width:15,height:15,cursor:'pointer',accentColor:'#0066ff'}} />
                      </td>
                      <td>
                        <div className="cell-primary">{lead.name}</div>
                        <div className="cell-secondary">{lead.company || '—'}{lead.role ? ` · ${lead.role}` : ''}</div>
                        {lead.last_contact && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>📧 Último contato: {new Date(lead.last_contact).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}
                        {(lead.call_count || 0) > 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>📞 {lead.call_count} ligação(ões)</div>}
                      </td>
                      <td>
                        {lead.email && <div className="cell-secondary">{lead.email}</div>}
                        {(lead.whatsapp || lead.phone) && <div className="cell-secondary">{lead.whatsapp || lead.phone}</div>}
                        {!lead.email && !lead.whatsapp && !lead.phone && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>{
                        (() => { const f = FUNNEL_MAP[normalizeStatus(lead.status)]; return f ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: f.bg, color: f.color, border: `1px solid ${f.color}33`, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color, flexShrink: 0 }} />{f.short}</span> : <span className={`badge badge-${lead.status}`}>{statusLabel(lead.status)}</span>; })()
                      }</td>
                      <td onClick={e => e.stopPropagation()}><div className="channel-icons">
                        {/* Enriquecer com Apollo */}
                        <button className="ch-icon" title="Enriquecer com Apollo.io (telefone, e-mail, decisor)" style={{color: enriching === lead.id ? '#f59e0b' : undefined, opacity: enriching === lead.id ? 0.6 : 1}} disabled={!!enriching} onClick={() => enrichLead(lead)}>
                          <Icon d={ICONS.enrich} />
                        </button>
                        {/* Agendar reunião */}
                        <button className="ch-icon" title="Agendar reunião no Google Calendar" style={{color:'#0066ff'}} onClick={() => { setCalModal(lead); setCalGuestEmail(lead.email || ''); setCalTitle(`Reunião com ${lead.name} — ${lead.company || ''}`); setCalDescription(''); setCalDate(new Date().toISOString().slice(0,10)); setCalSlots([]); setCalSelectedSlot(''); }}>
                          <Icon d={ICONS.calendar} />
                        </button>
                        {/* Analisar empresa */}
                        <button className="ch-icon enrich-btn" title={`Analisar empresa: ${lead.company || lead.name}`} onClick={() => { setLeadPanel(lead); setPanelAnalysis(null); setPanelTab('analysis'); analyzeCompany(lead); }}>
                          <Icon d={ICONS.sparkles} />
                        </button>
                        {/* Ligar */}
                        <button className="ch-icon phone-btn" title={lead.phone || lead.whatsapp ? `Ligar: ${lead.phone || lead.whatsapp}` : 'Registrar ligação'} onClick={() => { setCallModal(lead); setCallResult(''); setCallNotes(''); }}>
                          <Icon d={ICONS.phone} />
                        </button>
                        {/* E-mail */}
                        <button className="ch-icon email-btn" title={lead.email ? `E-mail: ${lead.email}` : 'Enviar e-mail (digitar endereço)'} onClick={() => openEmailModal(lead)}>
                          <Icon d={ICONS.email} />
                        </button>
                        {/* Observações */}
                        <button className="ch-icon" title="Ver/editar observações" style={{ color: (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g,'').trim() ? '#f59e0b' : 'var(--text-muted)' }} onClick={() => { const cleanNotes = (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g,'').trim(); setNoteModal(lead); setNoteText(cleanNotes); }}>
                          <Icon d={ICONS.note} />
                        </button>
                        {/* WhatsApp */}
                        <button className="ch-icon whatsapp-btn" title={lead.whatsapp || lead.phone ? `WhatsApp: ${lead.whatsapp || lead.phone}` : 'Sem número'} onClick={() => openWhatsModal(lead)}>
                          <Icon d={ICONS.whatsapp} />
                        </button>
                      </div></td>
                    </tr>
                  ))}
                </tbody></table></div>
              {/* CARDS MOBILE — visível apenas no mobile via CSS */}
              <div className="lead-cards">
                {filtered.map((lead: Lead) => {
                  const f = FUNNEL_MAP[normalizeStatus(lead.status)];
                  return (
                    <div key={lead.id} className="lead-card" onClick={() => { setLeadPanel(lead); setPanelAnalysis(null); setPanelTab('timeline'); }}>
                      <div className="lead-card-header">
                        <div className="lead-card-check" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={e => { const s = new Set(selectedIds); e.target.checked ? s.add(lead.id) : s.delete(lead.id); setSelectedIds(s); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        </div>
                        <div className="lead-card-info">
                          <div className="lead-card-name">{lead.name}</div>
                          <div className="lead-card-company">{lead.company}{lead.role ? ` · ${lead.role}` : ''}</div>
                        </div>
                        {f && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: f.bg, color: f.color, border: `1px solid ${f.color}33`, whiteSpace: 'nowrap', flexShrink: 0 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: f.color }} />{f.short}</span>}
                      </div>
                      <div className="lead-card-contact">
                        {lead.email && <span>✉ {lead.email}</span>}
                        {(lead.whatsapp || lead.phone) && <span>📱 {lead.whatsapp || lead.phone}</span>}
                        {lead.last_contact && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Último: {new Date(lead.last_contact).toLocaleDateString('pt-BR')}</span>}
                      </div>
                      <div className="lead-card-actions" onClick={e => e.stopPropagation()}>
                        <button className="ch-icon enrich-btn" title="Enriquecer" disabled={!!enriching} onClick={() => enrichLead(lead)}><Icon d={ICONS.enrich} /></button>
                        <button className="ch-icon" title="Agendar" style={{color:'#0066ff'}} onClick={() => { setCalModal(lead); setCalGuestEmail(lead.email || ''); setCalTitle(`Reunião com ${lead.name}`); setCalDescription(''); setCalDate(new Date().toISOString().slice(0,10)); setCalSlots([]); setCalSelectedSlot(''); }}><Icon d={ICONS.calendar} /></button>
                        <button className="ch-icon phone-btn" title="Ligar" onClick={() => { setCallModal(lead); setCallResult(''); setCallNotes(''); }}><Icon d={ICONS.phone} /></button>
                        <button className="ch-icon email-btn" title="E-mail" onClick={() => openEmailModal(lead)}><Icon d={ICONS.email} /></button>
                        <button className="ch-icon" title="Observações" style={{ color: (lead.notes||'').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g,'').trim() ? '#f59e0b' : 'var(--text-muted)' }} onClick={() => { const cleanNotes = (lead.notes||'').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g,'').trim(); setNoteModal(lead); setNoteText(cleanNotes); }}><Icon d={ICONS.note} /></button>
                        <button className="ch-icon whatsapp-btn" title="WhatsApp" onClick={() => {
                          const num = cleanPhone(lead.whatsapp || lead.phone || '');
                          if (!num) { showToast('Lead sem número de telefone'); return; }
                          const whatsTpl = templates.find((t: any) => t.type === 'whatsapp');
                          let msg = '';
                          if (whatsTpl) {
                            msg = whatsTpl.body.replace(/\{\{nome\}\}/g, lead.name.split(' ')[0]).replace(/\{\{empresa\}\}/g, lead.company || 'sua empresa').replace(/\{\{cargo\}\}/g, lead.role || 'decisor');
                          } else {
                            const wsNameW = ws?.name || 'getLOG/Lottustech';
                            msg = `Olá ${lead.name.split(' ')[0]}, tudo bem? Sou da ${wsNameW}. Nossa solução de TMS pode otimizar a operação logística da ${lead.company || 'sua empresa'}. Posso te mostrar em 15 min? — Danilo | (41) 99949-9815`;
                          }
                          window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}><Icon d={ICONS.whatsapp} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </>
          )}
          {view === 'dashboard' && <DashboardView leads={leads} workspace={workspace} wsName={ws?.name || ''} />}
          {view === 'inbox' && <InboxView workspace={workspace} gmailConfigured={gmailConfigured} leads={leads} showToast={showToast} />}
          {view === 'sent' && <SentEmailsView workspace={workspace} leads={leads} showToast={showToast} onOpenLead={(lead: Lead) => { setLeadPanel(lead); setPanelAnalysis(null); setPanelTab('timeline'); }} />}
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
          {view === 'templates' && <TemplatesView workspace={workspace} workspaceName={ws?.name} templates={templates} onReload={() => loadTemplates(workspace)} showToast={showToast} />}
          {view === 'agent' && <AgentView workspace={workspace} workspaceName={ws?.name} showToast={showToast} />}
          {view === 'bi' && <BIView workspace={workspace} leads={leads} />}
          {view === 'sheets' && <SheetsView workspace={workspace} workspaceName={ws?.name} onImport={(newLeads: any[]) => { setLeads(prev => { const ids = new Set(prev.map((l:any)=>l.id)); const fresh = newLeads.filter((l:any)=>!ids.has(l.id)); return [...fresh,...prev]; }); showToast(newLeads.length + ' lead(s) importado(s) do Sheets'); }} showToast={showToast} />}
          {view === 'settings' && <SettingsView gmailConfigured={gmailConfigured} hasDb={hasDb} showToast={showToast} />}
          {view === 'calendar_view' && <CalendarView meetings={allMeetings} leads={leads} onOpenLead={(lead: any) => { setLeadPanel(lead); setPanelTab('timeline'); }} onSchedule={(dateStr?: string) => { const firstLead = leads[0]; if (firstLead) { setCalModal(firstLead); setCalGuestEmail(firstLead.email || ''); setCalTitle(`Reunião com ${firstLead.name} — ${firstLead.company || ''}`); setCalDescription(''); setCalDate(dateStr || new Date().toISOString().slice(0,10)); setCalSlots([]); setCalSelectedSlot(''); } else { showToast('Adicione um lead primeiro para agendar uma reunião.'); } }} />}
        </div></div>
      </div>

      {/* Painel Lateral de Lead */}
      {leadPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) setLeadPanel(null); }}>
          <div style={{ flex: 1 }} onClick={() => setLeadPanel(null)} />
          <div style={{ width: Math.min(480, window.innerWidth), background: 'var(--surface)', boxShadow: '-4px 0 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            {/* Header do painel */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{leadPanel.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{leadPanel.company}{leadPanel.role ? ` · ${leadPanel.role}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                  <button className="btn btn-sm" title="Editar lead" onClick={() => { setEditing(leadPanel); setModalOpen(true); }}><Icon d={ICONS.edit} /></button>
                  <button className="btn btn-sm" title="Excluir lead" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={async () => { if (confirm(`Excluir "${leadPanel.name}"? Esta ação não pode ser desfeita.`)) { await removeLead(leadPanel.id, true); setLeadPanel(null); } }}><Icon d={ICONS.trash} /></button>
                  <button className="modal-close" onClick={() => setLeadPanel(null)} style={{ position: 'static', fontSize: 20, width: 32, height: 32 }}>×</button>
                </div>
              </div>
              {/* Mudança rápida de etapa do funil */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Etapa do funil</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {FUNNEL.map(f => {
                  const cur = normalizeStatus(leadPanel.status) === f.id;
                  return (
                    <button key={f.id} onClick={() => quickStatus(leadPanel, f.id)}
                      style={{ fontSize: 11, fontWeight: cur ? 700 : 500, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${cur ? f.color : 'var(--border)'}`, background: cur ? f.color : 'var(--surface)', color: cur ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all .15s' }}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Abas do painel */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              {([['info','Dados'],['timeline','Histórico'],['analysis','Análise IA']] as const).map(([t, lbl]) => (
                <button key={t} onClick={() => { setPanelTab(t); if (t === 'analysis' && !panelAnalysis && !analyzingLead) analyzeCompany(leadPanel); }}
                  style={{ flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: panelTab === t ? 700 : 400, borderBottom: panelTab === t ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', cursor: 'pointer', color: panelTab === t ? 'var(--primary)' : 'var(--text-muted)', transition: 'all .15s' }}>
                  {lbl}
                </button>
              ))}
            </div>
            {/* Conteúdo das abas */}
            <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
              {panelTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[['E-mail', leadPanel.email],['WhatsApp', leadPanel.whatsapp],['Telefone', leadPanel.phone],['LinkedIn', leadPanel.linkedin],['Fonte', leadPanel.source]].filter(([,v]) => v).map(([k,v]) => (
                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{k}</span>
                      <span style={{ fontWeight: 600, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                    </div>
                  ))}
                  {leadPanel.call_count ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📞 {leadPanel.call_count} ligação(ões) · último contato: {leadPanel.last_contact ? new Date(leadPanel.last_contact).toLocaleDateString('pt-BR') : '—'}</div> : null}
                  {leadPanel.notes && (() => {
                    const clean = leadPanel.notes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g,'').trim();
                    const decisorMatch = clean.match(/\[DECISOR\]([^\n]+)/);
                    const decisorInfo = decisorMatch ? decisorMatch[1].trim() : null;
                    const notesOnly = clean.replace(/\[DECISOR\][^\n]*\n?/g,'').trim();
                    return (
                      <>
                        {decisorInfo && (
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d', textTransform: 'uppercase', marginBottom: 4 }}>👤 Decisor (Apollo.io)</div>
                            <div style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>{decisorInfo}</div>
                          </div>
                        )}
                        {notesOnly ? <div style={{ marginTop: 8 }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Anotações</div><div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>{notesOnly}</div></div> : null}
                      </>
                    );
                  })()}
                  {/* Ações rápidas */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {(leadPanel.phone || leadPanel.whatsapp) && <a href={`tel:${cleanPhone(leadPanel.phone || leadPanel.whatsapp || '')}`} className="btn btn-sm" style={{ textDecoration: 'none' }}><Icon d={ICONS.phone} />Ligar</a>}
                    {(leadPanel.whatsapp || leadPanel.phone) && <button className="btn btn-sm" style={{ background: '#25d366', color: '#fff', border: 'none' }} onClick={() => { const num = cleanPhone(leadPanel.whatsapp || leadPanel.phone || ''); if (num) window.open(`https://wa.me/${num}`, '_blank'); }}><Icon d={ICONS.whatsapp} />WhatsApp</button>}
                    {leadPanel.email && <button className="btn btn-sm" onClick={() => openEmailModal(leadPanel)}><Icon d={ICONS.email} />E-mail</button>}
                    <button className="btn btn-sm" onClick={() => { setCallModal(leadPanel); setCallResult(''); setCallNotes(''); }}><Icon d={ICONS.phone} />Registrar ligação</button>
                  </div>
                </div>
              )}
              {panelTab === 'timeline' && (() => {
                const timeline = JSON.parse(leadPanel.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
                const created = { type: 'created', label: 'Lead criado', ts: leadPanel.created_at };
                const all = [...timeline, created];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {all.length === 1 ? <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Nenhum evento registrado ainda.<br/>Registre uma ligação ou mude o status para começar.</div> : null}
                    {all.map((ev: any, i: number) => {
                      const icons: any = { status: '🔄', call: '📞', email: '✉️', whatsapp: '💬', created: '🌱', note: '📝' };
                      const colors: any = { status: '#3b82f6', call: '#10b981', email: '#f59e0b', whatsapp: '#25d366', created: '#6366f1', note: '#8b5cf6' };
                      const c = colors[ev.type] || '#667085';
                      return (
                        <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: c + '18', border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, zIndex: 1 }}>{icons[ev.type] || '•'}</div>
                            {i < all.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
                          </div>
                          <div style={{ flex: 1, paddingTop: 4 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: c }}>{ev.label}</div>
                            {ev.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, background: 'var(--surface-2)', borderRadius: 6, padding: '5px 8px' }}>{ev.note}</div>}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{ev.ts ? new Date(ev.ts).toLocaleString('pt-BR') : '—'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {panelTab === 'analysis' && (
                analyzingLead ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                    <div style={{ fontSize: 13 }}>Analisando empresa com IA + CNPJ.já...</div>
                  </div>
                ) : panelAnalysis ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Dados da empresa */}
                    {panelAnalysis.company?.cnpj && (
                      <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Dados Oficiais (Receita Federal)</div>
                        {[['CNPJ', panelAnalysis.company.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')],['CNAE', panelAnalysis.company.cnae],['Porte', panelAnalysis.company.size],['Cidade', panelAnalysis.company.city && `${panelAnalysis.company.city}/${panelAnalysis.company.state}`],['Fundação', panelAnalysis.company.founded],['Status', panelAnalysis.company.status]].filter(([,v]) => v).map(([k,v]) => (
                          <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                        {panelAnalysis.company.members?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Sócios / Diretores</div>
                            {panelAnalysis.company.members.slice(0,3).map((m: any, i: number) => (
                              <div key={i} style={{ fontSize: 12, padding: '2px 0' }}><strong>{m.name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {m.role}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Score */}
                    {panelAnalysis.analysis?.score_potencial && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: panelAnalysis.analysis.score_potencial >= 7 ? '#10b981' : panelAnalysis.analysis.score_potencial >= 5 ? '#f59e0b' : '#ef4444' }}>{panelAnalysis.analysis.score_potencial}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>/10</span></div>
                        <div><div style={{ fontWeight: 600, fontSize: 13 }}>Score de Potencial</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Estimativa de conversão</div></div>
                      </div>
                    )}
                    {/* Resumo */}
                    {panelAnalysis.analysis?.resumo && <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Resumo</div><div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{panelAnalysis.analysis.resumo}</div></div>}
                    {/* Dores */}
                    {panelAnalysis.analysis?.dores_provaveis?.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Dores Prováveis</div>{panelAnalysis.analysis.dores_provaveis.map((d: string, i: number) => <div key={i} style={{ fontSize: 12, padding: '4px 0 4px 10px', borderLeft: '3px solid #ef4444', marginBottom: 4, color: 'var(--text-secondary)' }}>{d}</div>)}</div>}
                    {/* Abordagem */}
                    {panelAnalysis.analysis?.abordagem_sugerida && <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Como Abordar</div><div style={{ fontSize: 13, color: 'var(--text-secondary)', background: '#eff6ff', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6, borderLeft: '3px solid #3b82f6' }}>{panelAnalysis.analysis.abordagem_sugerida}</div></div>}
                    {/* Perguntas */}
                    {panelAnalysis.analysis?.perguntas_abertura?.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Perguntas de Abertura</div>{panelAnalysis.analysis.perguntas_abertura.map((q: string, i: number) => <div key={i} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: 'var(--surface-2)', marginBottom: 4, color: 'var(--text-secondary)' }}>💬 {q}</div>)}</div>}
                    {/* Oportunidades */}
                    {panelAnalysis.analysis?.oportunidades?.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Oportunidades</div>{panelAnalysis.analysis.oportunidades.map((o: string, i: number) => <div key={i} style={{ fontSize: 12, padding: '4px 0 4px 10px', borderLeft: '3px solid #10b981', marginBottom: 4, color: 'var(--text-secondary)' }}>{o}</div>)}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Fonte: {panelAnalysis.source}</div>
                    <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => analyzeCompany(leadPanel)}><Icon d={ICONS.refresh} />Atualizar análise</button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Análise Inteligente</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Pesquisa a empresa no CNPJ.já + IA e gera um briefing completo para sua negociação.</div>
                    <button className="btn btn-primary" onClick={() => analyzeCompany(leadPanel)}>✨ Analisar empresa</button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lead */}
      {modalOpen && <LeadModal lead={editing} workspace={workspace} onClose={() => setModalOpen(false)} onSave={async (l: Lead) => { await saveLead(l); setModalOpen(false); if (leadPanel && editing?.id === leadPanel.id) setLeadPanel(l); showToast(editing ? 'Lead atualizado' : 'Lead criado'); }} onDelete={editing ? async () => { await removeLead(editing.id); setModalOpen(false); setLeadPanel(null); } : undefined} />}

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
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div className="modal-title">✉ Enviar E-mail</div>
              <button className="modal-close" onClick={() => setEmailModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {emailModal.email ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Para: <strong>{emailModal.name}</strong> &lt;{emailModal.email}&gt;</div>
              ) : (
                <div className="field" style={{ marginBottom: 14 }}>
                  <label className="field-label">E-mail do destinatário</label>
                  <input className="field-input" type="email" placeholder="email@empresa.com" autoFocus
                    onChange={e => setEmailModal({ ...emailModal, email: e.target.value })} />
                </div>
              )}
              {/* Seletor de templates */}
              {templates.filter(t => t.type === 'email').length > 0 && (
                <div className="field">
                  <label className="field-label">Template</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      onClick={() => {
                        const wsName = ws?.name || 'getLOG/Lottustech';
                        setEmailSubject(`Apresentação ${wsName} — Solução TMS para ${emailModal.company || 'sua empresa'}`);
                        setEmailBody(`Olá ${emailModal.name.split(' ')[0]},\n\nTudo bem?\n\nMeu nome é Danilo Cabral, da ${wsName}. Percebo que empresas ${(emailModal as any).sector || 'atacadistas e distribuidoras'} como a ${emailModal.company || 'sua empresa'} buscam constantemente otimizar a operação logística e reduzir custos com frete.\n\nNossa solução de TMS já ajudou clientes a reduzir em até 20% os custos com transporte e melhorar a pontualidade de entregas. Que tal explorar como podemos gerar resultados semelhantes para a ${emailModal.company || 'sua empresa'}?\n\nMe diga qual o melhor horário para um bate-papo de 15 minutos.\n\nAtenciosamente,\nDanilo Cabral\nGerente Comercial | ${wsName}\ndanilo@lottustech.com.br | (41) 99949-9815\nwww.lottustech.com.br`);
                      }}
                    >
                      📝 Padrão
                    </button>
                    {templates.filter(t => t.type === 'email').map(tpl => (
                      <button
                        key={tpl.id}
                        className="btn btn-sm"
                        style={{ fontSize: 11, background: emailSubject === (tpl.subject || '') ? 'var(--primary)' : 'var(--surface-2)', color: emailSubject === (tpl.subject || '') ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}
                        onClick={() => {
                          const body = tpl.body
                            .replace(/\{\{nome\}\}/g, emailModal.name.split(' ')[0])
                            .replace(/\{\{empresa\}\}/g, emailModal.company || 'sua empresa')
                            .replace(/\{\{cargo\}\}/g, emailModal.role || 'decisor')
                            .replace(/\{\{workspace\}\}/g, ws?.name || 'getLOG/Lottustech');
                          const subject = (tpl.subject || '')
                            .replace(/\{\{nome\}\}/g, emailModal.name.split(' ')[0])
                            .replace(/\{\{empresa\}\}/g, emailModal.company || 'sua empresa')
                            .replace(/\{\{cargo\}\}/g, emailModal.role || 'decisor')
                            .replace(/\{\{workspace\}\}/g, ws?.name || 'getLOG/Lottustech');
                          setEmailSubject(subject || `Apresentação ${ws?.name} — ${emailModal.company || 'sua empresa'}`);
                          setEmailBody(body);
                        }}
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {templates.filter(t => t.type === 'email').length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  ⚠️ Nenhum template de e-mail criado. Vá em <strong>Templates</strong> no menu lateral para criar templates personalizados.
                </div>
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
              <button className="btn btn-primary" disabled={!emailModal.email || sendingEmail} onClick={sendEmail}>
                <Icon d={ICONS.send} />{sendingEmail ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Modal WhatsApp */}
      {whatsModal && (
        <div className="modal-overlay" onClick={() => setWhatsModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ICONS.whatsapp} /></svg>
                </span>
                Enviar WhatsApp
              </span>
              <button className="modal-close" onClick={() => setWhatsModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Para: <strong>{whatsModal.name}</strong>
                {(whatsModal.whatsapp || whatsModal.phone) && <> · <span style={{ color: '#25d366' }}>{whatsModal.whatsapp || whatsModal.phone}</span></>}
                {!whatsModal.whatsapp && !whatsModal.phone && <span style={{ color: '#f79009', marginLeft: 8 }}>⚠ Sem número cadastrado</span>}
              </div>
              {/* Seletor de templates WhatsApp */}
              {templates.filter(t => t.type === 'whatsapp').length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Templates</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {templates.filter(t => t.type === 'whatsapp').map((tpl: any) => (
                      <button key={tpl.id} className="btn btn-sm" style={{ fontSize: 11, background: '#25d366', color: '#fff', border: 'none' }} onClick={() => {
                        const body = tpl.body.replace(/\{\{nome\}\}/g, whatsModal.name.split(' ')[0]).replace(/\{\{empresa\}\}/g, whatsModal.company || 'sua empresa').replace(/\{\{cargo\}\}/g, whatsModal.role || 'decisor');
                        setWhatsBody(body);
                      }}>{tpl.name || 'Template'}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="field-group">
                <label className="field-label">Mensagem</label>
                <textarea className="field-input" rows={8} value={whatsBody} onChange={e => setWhatsBody(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
              </div>
              {zapiConfigured ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#079455', marginTop: 8 }}>
                  <span>●</span> Z-API configurada — envio automático disponível
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, padding: '8px 10px', background: 'var(--surface-2, #f9fafb)', borderRadius: 8 }}>
                  💡 <strong>Z-API não configurada</strong> — o botão abrirá o WhatsApp Web com a mensagem pronta.
                  Configure em <strong>Agente IA → WhatsApp</strong> para envio automático.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setWhatsModal(null)}>Cancelar</button>
              {(whatsModal.whatsapp || whatsModal.phone) ? (
                <button className="btn btn-primary" style={{ background: '#25d366', borderColor: '#25d366' }}
                  disabled={sendingWhats || !whatsBody.trim()}
                  onClick={() => sendWhatsApp(whatsModal, whatsBody, zapiConfigured)}>
                  <Icon d={ICONS.whatsapp} />
                  {sendingWhats ? 'Enviando...' : zapiConfigured ? 'Enviar via Z-API' : 'Abrir no WhatsApp Web'}
                </button>
              ) : (
                <button className="btn" disabled style={{ opacity: 0.5 }}>Sem número cadastrado</button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal de Observações */}
      {noteModal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setNoteModal(null); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">📝 Observações — {noteModal.name}</div>
              <button className="modal-close" onClick={() => setNoteModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{noteModal.company} {noteModal.role ? `· ${noteModal.role}` : ''}</div>
              <textarea
                className="field-input"
                style={{ minHeight: 200, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                placeholder="Anotações sobre este lead: o que foi conversado, próximos passos, observações importantes..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setNoteModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={savingNote} onClick={async () => {
                setSavingNote(true);
                try {
                  const timeline = JSON.parse(noteModal.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
                  const newNotes = noteText.trim() + (timeline.length > 0 ? `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` : '');
                  await saveLead({ ...noteModal, notes: newNotes, updated_at: Date.now() });
                  showToast('✓ Observações salvas');
                  setNoteModal(null);
                } catch { showToast('Erro ao salvar'); }
                setSavingNote(false);
              }}>{savingNote ? 'Salvando...' : '✓ Salvar observações'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Agendamento Google Calendar */}
      {calModal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setCalModal(null); }}>
          <div className="modal" style={{ maxWidth: 700, width: '95vw' }}>
            <div className="modal-header">
              <div className="modal-title">📅 Agendar Reunião — Google Calendar</div>
              <button className="modal-close" onClick={() => setCalModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Coluna esquerda: dados da reunião */}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{calModal.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{calModal.company} · {calModal.role}</div>
                  <div className="field">
                    <label className="field-label">E-mail do convidado *</label>
                    <input className="field-input" type="email" value={calGuestEmail} onChange={e => setCalGuestEmail(e.target.value)} placeholder="email@empresa.com" />
                  </div>
                  <div className="field">
                    <label className="field-label">Título da reunião</label>
                    <input className="field-input" type="text" value={calTitle} onChange={e => setCalTitle(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Pauta / Descrição</label>
                    <textarea className="field-input" rows={4} value={calDescription} onChange={e => setCalDescription(e.target.value)} placeholder="Tópicos a discutir, objetivos da reunião..." style={{ resize: 'vertical' }} />
                  </div>
                  <div className="field">
                    <label className="field-label">Data</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="field-input" type="date" value={calDate} onChange={e => setCalDate(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={!calDate || calLoadingSlots} onClick={async () => {
                        setCalLoadingSlots(true); setCalSlots([]); setCalSelectedSlot('');
                        try {
                          const r = await fetch(`/api/calendar?workspace=${workspace}&date=${calDate}`);
                          const j = await r.json();
                          if (j.error) { showToast(j.error); }
                          else { setCalSlots(j.slots || []); }
                        } catch { showToast('Erro ao buscar agenda'); }
                        setCalLoadingSlots(false);
                      }}>{calLoadingSlots ? '⏳' : '🔍 Ver agenda'}</button>
                    </div>
                  </div>
                </div>
                {/* Coluna direita: slots disponíveis */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)' }}>⏰ Horários disponíveis</div>
                  {calSlots.length === 0 && !calLoadingSlots && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Selecione uma data e clique em "Ver agenda"</div>
                  )}
                  {calLoadingSlots && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Carregando agenda...</div>
                  )}
                  {calSlots.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                      {calSlots.map(slot => {
                        const t = new Date(slot.time);
                        const label = t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const isSelected = calSelectedSlot === slot.time;
                        return (
                          <button key={slot.time} disabled={!slot.available} onClick={() => setCalSelectedSlot(slot.time)}
                            style={{ padding: '8px 4px', borderRadius: 8, border: isSelected ? '2px solid #0066ff' : '1px solid var(--border)', background: isSelected ? '#eff6ff' : slot.available ? 'var(--surface)' : '#f3f4f6', color: slot.available ? (isSelected ? '#0066ff' : 'var(--text)') : '#9ca3af', fontSize: 13, fontWeight: isSelected ? 700 : 400, cursor: slot.available ? 'pointer' : 'not-allowed', textDecoration: slot.available ? 'none' : 'line-through' }}>
                            {label}
                            {!slot.available && <span style={{ fontSize: 10, display: 'block', color: '#ef4444' }}>ocupado</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {calSelectedSlot && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#0066ff', fontWeight: 600 }}>
                      ✓ Selecionado: {new Date(calSelectedSlot).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — duração 1h
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setCalModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!calGuestEmail || !calSelectedSlot || calSaving} onClick={async () => {
                setCalSaving(true);
                try {
                  const endTime = new Date(new Date(calSelectedSlot).getTime() + 60 * 60 * 1000).toISOString();
                  const r = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace, guestEmail: calGuestEmail, guestName: calModal.name, startTime: calSelectedSlot, endTime, title: calTitle, description: calDescription }) });
                  const j = await r.json();
                  if (j.ok) {
                    const timeline = JSON.parse(calModal.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
                    const slotLabel = new Date(calSelectedSlot).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    timeline.unshift({ type: 'meeting', label: `Reunião agendada: ${slotLabel}${j.meetUrl ? ' · ' + j.meetUrl : ''}`, ts: Date.now() });
                    if (calDescription) timeline.unshift({ type: 'note', label: `Pauta: ${calDescription}`, ts: Date.now() });
                    const notesClean = (calModal.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
                    await saveLead({ ...calModal, status: normalizeStatus(calModal.status) === 'prospeccao' ? 'qualificacao' : normalizeStatus(calModal.status), updated_at: Date.now(), notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]` });
                    showToast(`✓ Reunião agendada! Invite enviado para ${calGuestEmail}`);
                    setCalModal(null);
                  } else {
                    showToast(j.error || 'Erro ao agendar reunião');
                  }
                } catch { showToast('Erro ao agendar reunião'); }
                setCalSaving(false);
              }}>{calSaving ? 'Agendando...' : '📅 Agendar e enviar invite'}</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL SENHA WORKSPACE */}
      {wsPassModal && (
        <div className="modal-bg" onClick={() => setWsPassModal(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e: any) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🔒 Trocar de Workspace</span>
              <button className="modal-close" onClick={() => setWsPassModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Digite a senha para acessar outro workspace.</p>
              <div className="field">
                <label className="field-label">Senha</label>
                <input
                  className="field-input"
                  type="password"
                  placeholder="••••••••"
                  value={wsPassInput}
                  onChange={(e: any) => setWsPassInput(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter') {
                      if (wsPassInput === WS_PASSWORD) {
                        const targetId = wsPassModal!;
                        setWorkspace(targetId); loadTemplates(targetId);
                        setSidebarOpen(false); setWsListOpen(false);
                        setWsPassModal(null); setWsPassInput('');
                      } else { alert('Senha incorreta!'); setWsPassInput(''); }
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setWsPassModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                if (wsPassInput === WS_PASSWORD) {
                  const targetId = wsPassModal!;
                  setWorkspace(targetId); loadTemplates(targetId);
                  setSidebarOpen(false); setWsListOpen(false);
                  setWsPassModal(null); setWsPassInput('');
                } else { alert('Senha incorreta!'); setWsPassInput(''); }
              }}>Entrar</button>
            </div>
          </div>
        </div>
      )}
      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
// ---------- Calendário de Reuniões ----------
function CalendarView({ meetings, leads, onOpenLead, onSchedule }: any) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const [curYear, setCurYear] = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [metaReuniao, setMetaReuniao] = useState(() => {
    if (typeof window !== 'undefined') return Number(localStorage.getItem('meta_reuniao_semana') || '5');
    return 5;
  });
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');

  // Calcular reuniões desta semana (seg a dom)
  const getWeekStart = (d: Date) => { const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); };
  const weekStart = getWeekStart(new Date());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const reunioesSemana = meetings.filter((m: any) => {
    const match = m.label?.match(/(\d{2}\/(\d{2})\/(\d{4}))/);
    const dateKey = match ? match[1].split('/').reverse().join('-') : new Date(m.ts).toISOString().slice(0, 10);
    return dateKey >= weekStartStr && dateKey <= weekEndStr;
  }).length;

  // Agrupa reuniões por data (YYYY-MM-DD)
  const grouped: Record<string, any[]> = {};
  for (const m of meetings) {
    const match = m.label?.match(/(\d{2}\/\d{2}\/\d{4})/);
    const dateKey = match
      ? match[1].split('/').reverse().join('-')
      : new Date(m.ts).toISOString().slice(0, 10);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(m);
  }

  // Gera os dias do mês atual
  const firstDay = new Date(curYear, curMonth, 1);
  const lastDay = new Date(curYear, curMonth + 1, 0);
  const startDow = firstDay.getDay(); // 0=dom
  const totalDays = lastDay.getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const dowLabels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  const prevMonth = () => { if (curMonth === 0) { setCurMonth(11); setCurYear(y => y - 1); } else setCurMonth(m => m - 1); };
  const nextMonth = () => { if (curMonth === 11) { setCurMonth(0); setCurYear(y => y + 1); } else setCurMonth(m => m + 1); };

  const dayKey = (d: number) => `${curYear}-${String(curMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const selectedMeetings = selectedDay ? (grouped[selectedDay] || []) : [];

  const renderMeeting = (m: any) => {
    const lead = leads.find((l: any) => l.id === m.leadId);
    const timeMatch = m.label?.match(/(\d{2}:\d{2})/);
    const timeStr = timeMatch ? timeMatch[1] : '';
    const meetUrl = m.label?.match(/https:\/\/meet\.google\.com\/[\w-]+/)?.[0];
    const isPast = (selectedDay || '') < todayStr;
    return (
      <div key={m.ts + m.leadId} style={{ padding: '12px 14px', background: isPast ? 'var(--surface)' : '#eff6ff', borderRadius: 10, border: `1px solid ${isPast ? 'var(--border)' : '#bfdbfe'}`, marginBottom: 10, opacity: isPast ? 0.75 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.leadName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.leadCompany}</div>
          </div>
          {timeStr && <div style={{ fontSize: 13, color: '#0066ff', fontWeight: 700, background: '#dbeafe', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>⏰ {timeStr}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {meetUrl && (
            <a href={meetUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', background: '#0066ff', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
              🎥 Entrar no Meet
            </a>
          )}
          {lead && (
            <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => onOpenLead(lead)}>Ver lead</button>
          )}
        </div>
      </div>
    );
  };

  // Próximas reuniões (todos os meses)
  const allUpcoming = Object.keys(grouped).filter(d => d >= todayStr).sort();

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title">📅 Calendário de Reuniões</div>
          <div className="page-description">{meetings.length} reunião(ões) agendada(s) no total</div>
        </div>
        <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => onSchedule && onSchedule()}>
          + Nova Reunião
        </button>
      </div>

      {/* Meta de reuniões por semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>🎯 Meta de Reuniões — Esta Semana</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingMeta ? (
                <>
                  <input type="number" min={1} max={50} value={metaInput}
                    onChange={(e: any) => setMetaInput(e.target.value)}
                    style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, textAlign: 'center' }}
                    onKeyDown={(e: any) => { if (e.key === 'Enter') { const v = Number(metaInput); if (v > 0) { setMetaReuniao(v); localStorage.setItem('meta_reuniao_semana', String(v)); } setEditingMeta(false); } }}
                    autoFocus
                  />
                  <button className="btn btn-sm" style={{ background: '#0066ff', color: 'white', border: 'none', fontSize: 11 }} onClick={() => { const v = Number(metaInput); if (v > 0) { setMetaReuniao(v); localStorage.setItem('meta_reuniao_semana', String(v)); } setEditingMeta(false); }}>✓</button>
                  <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingMeta(false)}>✕</button>
                </>
              ) : (
                <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => { setMetaInput(String(metaReuniao)); setEditingMeta(true); }}>✏ Editar meta</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, height: 16, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min((reunioesSemana / metaReuniao) * 100, 100)}%`, height: '100%', background: reunioesSemana >= metaReuniao ? '#10b981' : '#0066ff', borderRadius: 8, transition: 'width 0.4s ease', minWidth: reunioesSemana > 0 ? 16 : 0 }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: reunioesSemana >= metaReuniao ? '#10b981' : '#0066ff', flexShrink: 0 }}>
              {reunioesSemana} / {metaReuniao}
            </div>
            {reunioesSemana >= metaReuniao && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>🏆 Meta atingida!</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Semana de {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} a {weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Calendário mensal */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Cabeçalho do mês */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{monthNames[curMonth]} {curYear}</div>
            <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
          {/* Dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 12px 0' }}>
            {dowLabels.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>
          {/* Semanas */}
          <div style={{ padding: '4px 12px 12px' }}>
            {weeks.map((wk, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {wk.map((d, di) => {
                  if (!d) return <div key={di} />;
                  const dk = dayKey(d);
                  const hasMeeting = !!grouped[dk];
                  const isToday = dk === todayStr;
                  const isSelected = dk === selectedDay;
                  return (
                    <button key={di} onClick={() => setSelectedDay(dk)}
                      style={{
                        aspectRatio: '1', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isToday || isSelected ? 700 : 400, position: 'relative',
                        background: isSelected ? '#0066ff' : isToday ? '#eff6ff' : 'transparent',
                        color: isSelected ? 'white' : isToday ? '#0066ff' : 'var(--text)',
                        outline: isToday && !isSelected ? '2px solid #0066ff' : 'none',
                      }}>
                      {d}
                      {hasMeeting && (
                        <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: isSelected ? 'white' : '#0066ff', display: 'block' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legenda */}
          <div style={{ padding: '8px 18px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0066ff', display: 'inline-block' }} /> Reunião agendada</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: '#eff6ff', border: '2px solid #0066ff', display: 'inline-block' }} /> Hoje</span>
          </div>
        </div>

        {/* Painel lateral — reuniões do dia selecionado */}
        <div>
          {selectedDay && (
            <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {selectedDay === todayStr ? '📌 Hoje' : new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedMeetings.length} reunião(ões)</div>
                </div>
                <button className="btn btn-sm" style={{ fontSize: 11, background: '#0066ff', color: 'white', border: 'none' }}
                  onClick={() => onSchedule && onSchedule(selectedDay)}>
                  + Agendar
                </button>
              </div>
              <div style={{ padding: 12 }}>
                {selectedMeetings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Nenhuma reunião neste dia.
                    <br />
                    <button className="btn btn-sm" style={{ marginTop: 8, fontSize: 11 }} onClick={() => onSchedule && onSchedule(selectedDay)}>Agendar reunião</button>
                  </div>
                ) : selectedMeetings.map(m => renderMeeting(m))}
              </div>
            </div>
          )}

          {/* Próximas reuniões resumo */}
          {allUpcoming.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>📋 Próximas reuniões</div>
              <div style={{ padding: '8px 12px', maxHeight: 300, overflowY: 'auto' }}>
                {allUpcoming.slice(0, 10).map(d => (
                  <button key={d} onClick={() => { setSelectedDay(d); const [y,mo] = d.split('-').map(Number); setCurYear(y); setCurMonth(mo-1); }}
                    style={{ width: '100%', textAlign: 'left', background: d === selectedDay ? '#eff6ff' : 'transparent', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: d === todayStr ? '#0066ff' : 'var(--text)' }}>
                        {d === todayStr ? '📌 Hoje' : new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{grouped[d].map((m: any) => m.leadName).join(', ')}</div>
                    </div>
                    <span style={{ fontSize: 11, background: '#0066ff', color: 'white', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>{grouped[d].length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ---------- Dashboard ----------
function DashboardView({ leads, workspace, wsName }: { leads: any[], workspace: string, wsName: string }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Extrair todos os eventos da timeline de todos os leads
  const allEvents: any[] = [];
  for (const lead of leads) {
    const tl = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
    for (const ev of tl) {
      allEvents.push({ ...ev, leadName: lead.name, leadCompany: lead.company, leadId: lead.id });
    }
  }

  // Contadores de hoje
  const todayEvents = allEvents.filter(ev => {
    if (!ev.ts) return false;
    return new Date(ev.ts).toISOString().slice(0, 10) === todayStr;
  });
  const todayEmails = todayEvents.filter(ev => ev.type === 'email').length;
  const todayCalls = todayEvents.filter(ev => ev.type === 'call').length;
  const todayWhats = todayEvents.filter(ev => ev.type === 'whatsapp').length;
  const todayTotal = todayEmails + todayCalls + todayWhats;

  // Últimos 7 dias
  const days7: { label: string; date: string; emails: number; calls: number; whats: number; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const dayEvs = allEvents.filter(ev => ev.ts && new Date(ev.ts).toISOString().slice(0, 10) === ds);
    days7.push({
      label: i === 0 ? 'Hoje' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      date: ds,
      emails: dayEvs.filter(ev => ev.type === 'email').length,
      calls: dayEvs.filter(ev => ev.type === 'call').length,
      whats: dayEvs.filter(ev => ev.type === 'whatsapp').length,
      total: dayEvs.filter(ev => ['email','call','whatsapp'].includes(ev.type)).length,
    });
  }
  const maxVal = Math.max(...days7.map(d => d.total), 1);

  // Funil
  const funnel = [
    { label: 'Prospecção', count: leads.filter(l => ['prospeccao','novo'].includes(l.status)).length, color: '#6b7280' },
    { label: 'Qualificação', count: leads.filter(l => l.status === 'qualificacao').length, color: '#f59e0b' },
    { label: 'Apresentação', count: leads.filter(l => l.status === 'apresentacao').length, color: '#3b82f6' },
    { label: 'Fechamento', count: leads.filter(l => l.status === 'fechamento').length, color: '#8b5cf6' },
    { label: 'Pós-venda', count: leads.filter(l => l.status === 'posvenda').length, color: '#10b981' },
  ];
  const funnelMax = Math.max(...funnel.map(f => f.count), 1);

  // Últimas atividades
  const recentEvs = allEvents
    .filter(ev => ['email','call','whatsapp'].includes(ev.type) && ev.ts)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  const typeIcon: any = { email: '✉', call: '📞', whatsapp: '💬', enrich: '⚙', status: '→', meeting: '📅' };
  const typeColor: any = { email: '#1a56db', call: '#0066ff', whatsapp: '#25D366' };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Dashboard</div>
          <div className="page-description">{wsName} — Desempenho de prospecção</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Cards do dia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Atividades Hoje', value: todayTotal, color: '#0066ff', bg: '#eff6ff', icon: '⚡' },
          { label: 'E-mails Enviados', value: todayEmails, color: '#1a56db', bg: '#eff6ff', icon: '✉' },
          { label: 'Ligações Feitas', value: todayCalls, color: '#7c3aed', bg: '#f5f3ff', icon: '📞' },
          { label: 'WhatsApp Enviados', value: todayWhats, color: '#059669', bg: '#ecfdf5', icon: '💬' },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 10, padding: '16px 18px', borderTop: `3px solid ${card.color}` }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color, letterSpacing: '-0.02em' }}>{card.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Gráfico de barras — últimos 7 dias */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Atividades — Últimos 7 dias</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {days7.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{d.total > 0 ? d.total : ''}</div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 4, overflow: 'hidden' }}>
                  {d.emails > 0 && <div style={{ height: Math.round((d.emails / maxVal) * 80), background: '#1a56db', minHeight: 3 }} title={`${d.emails} e-mails`} />}
                  {d.calls > 0 && <div style={{ height: Math.round((d.calls / maxVal) * 80), background: '#7c3aed', minHeight: 3 }} title={`${d.calls} ligações`} />}
                  {d.whats > 0 && <div style={{ height: Math.round((d.whats / maxVal) * 80), background: '#25D366', minHeight: 3 }} title={`${d.whats} WhatsApp`} />}
                  {d.total === 0 && <div style={{ height: 4, background: 'var(--border)', borderRadius: 4 }} />}
                </div>
                <div style={{ fontSize: 10, color: d.date === todayStr ? '#0066ff' : 'var(--text-muted)', fontWeight: d.date === todayStr ? 700 : 400 }}>{d.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1a56db', borderRadius: 2, marginRight: 4 }} />E-mail</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#7c3aed', borderRadius: 2, marginRight: 4 }} />Ligação</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#25D366', borderRadius: 2, marginRight: 4 }} />WhatsApp</span>
          </div>
        </div>

        {/* Funil de vendas */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Funil de Vendas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnel.map((f, i) => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 90, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>{f.label}</div>
                <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 4, height: 22, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max((f.count / funnelMax) * 100, f.count > 0 ? 8 : 0)}%`,
                    height: '100%', background: f.color, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
                    transition: 'width 0.4s ease'
                  }}>
                    {f.count > 0 && <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>{f.count}</span>}
                  </div>
                </div>
                {f.count === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0</span>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total de leads: </span>
            <strong>{leads.length}</strong>
            {funnel[4].count > 0 && <span style={{ marginLeft: 12, color: '#10b981' }}>✓ {funnel[4].count} convertido(s)</span>}
          </div>
        </div>
      </div>

      {/* Últimas atividades */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Últimas Atividades</div>
        {recentEvs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma atividade registrada ainda. Envie um e-mail ou faça uma ligação para começar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentEvs.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < recentEvs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${typeColor[ev.type] || '#6b7280'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {typeIcon[ev.type] || '•'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.leadName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {ev.leadCompany}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {ev.ts ? new Date(ev.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ---------- E-mails Enviados ----------
function SentEmailsView({ workspace, leads, showToast, onOpenLead }: any) {
  const [emails, setEmails] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<any>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/sent-emails?workspace=${workspace}&search=${encodeURIComponent(search)}&limit=300`);
      const d = await r.json();
      if (d.ok) setEmails(d.emails || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [workspace, search]);

  React.useEffect(() => { load(); }, [load]);

  const grouped = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const e of emails) {
      const day = new Date(e.ts).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    }
    return groups;
  }, [emails]);

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Lista de e-mails */}
      <div style={{ width: selected ? 380 : '100%', minWidth: 320, borderRight: selected ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div className="page-title" style={{ fontSize: 18 }}>📤 E-mails Enviados</div>
              <div className="page-description">{loading ? 'Carregando...' : `${emails.length} e-mail(s) disparado(s)`}</div>
            </div>
            <button className="btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={load}>↻ Atualizar</button>
          </div>
          <input
            className="search-input"
            placeholder="Buscar por nome, empresa, assunto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', fontSize: 13 }}
          />
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando e-mails...</div>
          ) : emails.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum e-mail enviado ainda</div>
              <div style={{ fontSize: 12 }}>Os e-mails disparados pelo CRM aparecerão aqui</div>
            </div>
          ) : (
            Object.entries(grouped).map(([day, dayEmails]) => (
              <div key={day}>
                <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {day}
                </div>
                {dayEmails.map((email: any) => (
                  <div
                    key={email.id}
                    onClick={() => setSelected(selected?.id === email.id ? null : email)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selected?.id === email.id ? 'var(--primary-light, #eff6ff)' : 'var(--surface)',
                      borderLeft: selected?.id === email.id ? '3px solid #0066ff' : '3px solid transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email.leadName || '(sem nome)'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email.leadCompany}{email.leadRole ? ` · ${email.leadRole}` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {email.subject}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          ✉ {email.leadEmail || '(sem e-mail)'}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(email.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {email.opened && (
                          <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2, fontWeight: 600 }}>✓ Aberto</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Painel de detalhe */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{selected.subject}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Para: <strong>{selected.leadName}</strong> &lt;{selected.leadEmail}&gt;
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(selected.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {selected.opened && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>✓ E-mail aberto</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px' }}
                onClick={() => {
                  const lead = leads.find((l: any) => l.id === selected.leadId);
                  if (lead) onOpenLead(lead);
                  else showToast('Lead não encontrado');
                }}>
                Ver lead
              </button>
              <button className="btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setSelected(null)}>✕</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>DESTINATÁRIO</div>
                  <div style={{ fontWeight: 600 }}>{selected.leadName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.leadRole}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>EMPRESA</div>
                  <div style={{ fontWeight: 600 }}>{selected.leadCompany || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>E-MAIL</div>
                  <div style={{ fontSize: 12 }}>{selected.leadEmail || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>STATUS</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected.opened ? '#16a34a' : 'var(--text-muted)' }}>
                    {selected.opened ? '✓ Aberto' : '📤 Enviado'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ASSUNTO</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{selected.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>MENSAGEM REGISTRADA</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                (O corpo do e-mail não é armazenado por privacidade — apenas o assunto e data/hora ficam registrados na timeline do lead.)
              </div>
            </div>
          </div>
        </div>
      )}
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
      const r = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: compose.to, subject: compose.subject, body: compose.body, workspaceSlug: workspace }) });
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
  const [editingWs, setEditingWs] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const saveEdit = async () => {
    if (!editingWs?.name?.trim()) { showToast('Nome obrigatório'); return; }
    setSavingEdit(true);
    try {
      await fetch('/api/workspaces', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingWs.id, name: editingWs.name.trim(), color: editingWs.color }) });
      await onReload();
      setEditingWs(null); showToast('Workspace atualizado!');
    } catch { showToast('Erro ao salvar'); }
    setSavingEdit(false);
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
      <div className="page-header"><div><div className="page-title">Workspaces</div><div className="page-description">Gerencie seus espaços de trabalho — o nome é usado nos templates da IA</div></div></div>
      <div className="table-wrap" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Criar novo workspace</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}><label className="field-label">Nome</label><input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: getLOG/Lottustech" /></div>
          <div className="field"><label className="field-label">Cor</label><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} /></div>
          <button className="btn btn-primary" onClick={create} disabled={saving}><Icon d={ICONS.plus} />{saving ? 'Criando...' : 'Criar'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workspaces.map((w: Workspace) => (
          <div key={w.id} className="account-card">
            <span className="ws-dot" style={{ background: w.color, width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }} />
            <div className="account-info"><div className="account-ws">{w.name}</div><div className="account-email" style={{ fontSize: 11 }}>ID: {w.id}</div></div>
            <button className="btn btn-sm" onClick={() => setEditingWs({ ...w })} title="Editar nome e cor"><Icon d={ICONS.edit} /></button>
            {!['lottus', 'iota', 'splice'].includes(w.id) && (
              <button className="btn btn-danger btn-sm" onClick={() => remove(w.id)}><Icon d={ICONS.trash} /></button>
            )}
          </div>
        ))}
      </div>

      {editingWs && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEditingWs(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Editar workspace</div>
              <button className="modal-close" onClick={() => setEditingWs(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="field-label">Nome do workspace</label>
                <input className="field-input" value={editingWs.name} onChange={e => setEditingWs({ ...editingWs, name: e.target.value })} placeholder="Ex: getLOG/Lottustech" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Este nome aparece nos templates gerados pela IA e no cabeçalho do CRM</div>
              </div>
              <div className="field">
                <label className="field-label">Cor</label>
                <input type="color" value={editingWs.color} onChange={e => setEditingWs({ ...editingWs, color: e.target.value })} style={{ width: 60, height: 38, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setEditingWs(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
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
  const [tab, setTab] = useState('empresa');
  // Busca unificada por empresa
  const [query, setQuery] = useState('');
  const [queryMode, setQueryMode] = useState<'cnpj' | 'name' | 'segment'>('name');
  const [stateFilter, setStateFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchDetail, setSearchDetail] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [searchTotal, setSearchTotal] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // Importar planilha
  const [importPreview, setImportPreview] = useState<any[]>([]);
  // Apollo
  const [filters, setFilters] = useState({ country: 'Brasil', department: 'ti', level: 'decisores', industry: '', qty: '25' });
  const [searching, setSearching] = useState(false);
  const [apolloResults, setApolloResults] = useState<any[]>([]);

  const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  const buildFromCnpja = (data: any) => ({
    name: data.alias || data.name || '',
    company: data.name || data.alias || '',
    role: data.members?.[0] ? `${data.members[0].role} — ${data.members[0].name}` : '',
    email: data.email || '',
    phone: data.phone || '',
    whatsapp: data.phone ? data.phone.replace(/\D/g,'') : '',
    notes: [
      data.cnpj ? `CNPJ: ${data.cnpj}` : '',
      data.cnae ? `CNAE: ${data.cnae}` : '',
      data.street ? `Endereço: ${data.street}, ${data.district || ''}, ${data.city}/${data.state}` : '',
      data.size ? `Porte: ${data.size}` : '',
      data.founded ? `Fundada: ${data.founded}` : '',
      data.members?.length ? `Sócios: ${data.members.map((m: any) => `${m.name} (${m.role})`).join(', ')}` : ''
    ].filter(Boolean).join('\n'),
    source: 'CNPJ.já'
  });

  const addToCart = async (data: any) => {
    const lead = buildFromCnpja(data);
    await onImport([lead]);
    const key = data.cnpj || data.name;
    setAddedIds(prev => new Set([...prev, key]));
    // Remove o card da lista após 600ms para feedback visual
    setTimeout(() => setSearchResults(prev => prev.filter(r => (r.cnpj || r.name) !== key)), 600);
    showToast('Lead adicionado à carteira!');
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setSearchResults([]); setSearchDetail(null); setSearchError('');
    try {
      if (queryMode === 'cnpj') {
        // Busca direta por CNPJ no CNPJ.já
        const url = `/api/cnpja?cnpj=${encodeURIComponent(query.replace(/\D/g,''))}`;
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok) { setSearchError(j.error || 'CNPJ não encontrado'); }
        else { setSearchDetail(j); showToast('Empresa encontrada!'); }
      } else {
        // Busca por nome ou segmento via IA + CNPJ.já
        const r = await fetch('/api/search-companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, mode: queryMode, state: stateFilter, limit: 12 })
        });
        const j = await r.json();
        if (!r.ok) { setSearchError(j.error || 'Erro na busca'); }
        else if (j.results?.length > 0) {
          setSearchResults(j.results);
          setSearchTotal(j.total || j.results.length);
          const verified = j.verified || 0;
          showToast(`${j.results.length} empresa(s) encontrada(s)${verified < j.results.length ? ` (⚠️ ${j.results.length - verified} não verificadas)` : ''}`);
        } else {
          setSearchError(j.message || `Nenhuma empresa encontrada para "${query}".`);
        }
      }
    } catch { setSearchError('Erro de conexão. Tente novamente.'); }
    setLoading(false);
  };

  const realSearch = async () => {
    setSearching(true); setApolloResults([]);
    try {
      const r = await fetch('/api/prospect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filters) });
      const j = await r.json();
      if (j.ok) { setApolloResults(j.leads || []); showToast(`${j.count} leads encontrados`); }
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

  const modeLabels: any = { cnpj: 'CNPJ', name: 'Nome da empresa', segment: 'Segmento / CNAE' };
  const modePlaceholders: any = {
    cnpj: 'Ex: 53.113.791/0001-22',
    name: 'Ex: TOTVS, Grupo Alltech, Localfrio...',
    segment: 'Ex: transporte, logística, atacado, TMS, 4930...'
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Buscar Leads</div>
          <div className="page-description">Encontre empresas por CNPJ, nome ou segmento e adicione à sua carteira</div>
        </div>
      </div>

      {/* Abas */}
      <div className="filter-group" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`filter-tab${tab === 'empresa' ? ' active' : ''}`} onClick={() => setTab('empresa')} style={{ fontWeight: 700 }}>🔍 Buscar empresa</button>
        <button className={`filter-tab${tab === 'apollo' ? ' active' : ''}`} onClick={() => setTab('apollo')}>Apollo.io</button>
        <button className={`filter-tab${tab === 'importar' ? ' active' : ''}`} onClick={() => setTab('importar')}>Importar planilha</button>
      </div>

      {/* ── Aba principal: Busca por empresa ── */}
      {tab === 'empresa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tipo de busca */}
          <div className="table-wrap" style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buscar por</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['cnpj', 'name', 'segment'] as const).map(m => (
                  <button key={m} className={`filter-tab${queryMode === m ? ' active' : ''}`}
                    onClick={() => { setQueryMode(m); setSearchResults([]); setSearchDetail(null); setSearchError(''); }}>
                    {m === 'cnpj' ? '🔢 CNPJ' : m === 'name' ? '🏢 Nome' : '🏭 Segmento'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campo de busca */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                className="field-input"
                style={{ flex: 1 }}
                placeholder={modePlaceholders[queryMode]}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
              />
              {queryMode !== 'cnpj' && (
                <select className="field-select" style={{ width: 90, flexShrink: 0 }} value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                  <option value="">UF</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <button className="btn btn-primary" onClick={doSearch} disabled={loading} style={{ flexShrink: 0, minWidth: 110 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Buscando...
                  </span>
                ) : <><Icon d={ICONS.search2} />Buscar</>}
              </button>
            </div>

            {queryMode === 'segment' && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px' }}>
                💡 Exemplos de segmentos: <strong>transporte</strong>, <strong>logística</strong>, <strong>atacado</strong>, <strong>tecnologia</strong>, <strong>saúde</strong>, <strong>varejo</strong>, <strong>construção</strong>, <strong>agro</strong> — ou código CNAE (ex: <strong>4930</strong>)
              </div>
            )}

            {searchError && (
              <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                {searchError}
              </div>
            )}
          </div>

          {/* Resultado único (CNPJ direto) */}
          {searchDetail && (
            <div className="table-wrap" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{searchDetail.alias || searchDetail.name}</div>
                  {searchDetail.alias !== searchDetail.name && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{searchDetail.name}</div>}
                  <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4, fontWeight: 600 }}>CNPJ: {searchDetail.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</div>
                </div>
                <button
                  className={`btn ${addedIds.has(searchDetail.cnpj || searchDetail.name) ? '' : 'btn-primary'}`}
                  onClick={() => addToCart(searchDetail)}
                  disabled={addedIds.has(searchDetail.cnpj || searchDetail.name)}
                  style={{ flexShrink: 0 }}
                >
                  {addedIds.has(searchDetail.cnpj || searchDetail.name) ? '✓ Adicionado' : '+ Adicionar à carteira'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, marginBottom: 14 }}>
                {searchDetail.phone && <div><span style={{ color: 'var(--text-muted)' }}>Telefone:</span> <strong>{searchDetail.phone}</strong></div>}
                {searchDetail.email && <div><span style={{ color: 'var(--text-muted)' }}>E-mail:</span> <strong>{searchDetail.email}</strong></div>}
                {searchDetail.city && <div><span style={{ color: 'var(--text-muted)' }}>Cidade:</span> <strong>{searchDetail.city}/{searchDetail.state}</strong></div>}
                {searchDetail.size && <div><span style={{ color: 'var(--text-muted)' }}>Porte:</span> <strong>{searchDetail.size}</strong></div>}
                {searchDetail.status && <div><span style={{ color: 'var(--text-muted)' }}>Situação:</span> <strong style={{ color: searchDetail.status === 'Ativa' ? '#22c55e' : '#ef4444' }}>{searchDetail.status}</strong></div>}
                {searchDetail.founded && <div><span style={{ color: 'var(--text-muted)' }}>Fundação:</span> <strong>{searchDetail.founded}</strong></div>}
                {searchDetail.cnae && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-muted)' }}>CNAE:</span> <strong>{searchDetail.cnae}</strong></div>}
                {searchDetail.street && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-muted)' }}>Endereço:</span> <strong>{searchDetail.street}, {searchDetail.district} — {searchDetail.zip}</strong></div>}
              </div>
              {searchDetail.members?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sócios / Diretores</div>
                  {searchDetail.members.map((m: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 500 }}>{m.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{m.role}{m.since ? ` · desde ${m.since?.slice(0,4)}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchDetail.sideActivities?.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Atividades secundárias: </span>
                  {searchDetail.sideActivities.join(' • ')}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>Fonte: {searchDetail.source}</div>
            </div>
          )}

          {/* Lista de resultados (busca por nome ou segmento) */}
          {searchResults.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>{searchResults.length}</strong> resultado(s){searchTotal > searchResults.length ? ` de ${searchTotal.toLocaleString()} encontrados` : ''}
                </div>
                <button className="btn btn-primary btn-sm" onClick={async () => { const all = [...searchResults]; for (const r of all) { await onImport([buildFromCnpja(r)]); } setAddedIds(new Set(all.map(r => r.cnpj || r.name))); setTimeout(() => setSearchResults([]), 600); showToast(`${all.length} leads adicionados à carteira!`); }}>
                  <Icon d={ICONS.download} />Adicionar todos
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {searchResults.map((r: any, i: number) => {
                  const key = r.cnpj || r.name;
                  const added = addedIds.has(key);
                  return (
                    <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${added ? '#22c55e44' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'border-color .2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.alias || r.name}</div>
                          {r.alias && r.alias !== r.name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.name}</div>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {r.cnpj && <span>CNPJ: {r.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</span>}
                            {r.city && <span>📍 {r.city}/{r.state}</span>}
                            {r.size && <span>🏢 {r.size}</span>}
                          </div>
                          {r.cnae && <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 3, fontWeight: 500 }}>{r.cnae}</div>}
                          <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                            {r.phone && <span>📞 {r.phone}</span>}
                            {r.email && <span>✉️ {r.email}</span>}
                          </div>
                          {r.members?.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              👤 {r.members.slice(0,2).map((m: any) => `${m.name} (${m.role})`).join(' · ')}
                            </div>
                          )}
                        </div>
                        <button
                          className={`btn btn-sm${added ? '' : ' btn-primary'}`}
                          style={{ flexShrink: 0, minWidth: 110 }}
                          onClick={() => addToCart(r)}
                          disabled={added}
                        >
                          {added ? '✓ Adicionado' : '+ Adicionar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Apollo.io ── */}
      {tab === 'apollo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="table-wrap" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field"><label className="field-label">País</label><select className="field-select" value={filters.country} onChange={e => setFilters({ ...filters, country: e.target.value })}><option>Brasil</option><option>Estados Unidos</option><option>Portugal</option></select></div>
              <div className="field"><label className="field-label">Setor</label><select className="field-select" value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })}><option value="ti">TI / Tecnologia</option><option value="operacoes">Operações</option><option value="logistica">Logística</option><option value="comercial">Comercial</option></select></div>
              <div className="field"><label className="field-label">Nível</label><select className="field-select" value={filters.level} onChange={e => setFilters({ ...filters, level: e.target.value })}><option value="decisores">C-level / Diretor</option><option value="donos">Donos / Fundadores</option><option value="gerencia">Gerência</option></select></div>
              <div className="field"><label className="field-label">Qtd</label><select className="field-select" value={filters.qty} onChange={e => setFilters({ ...filters, qty: e.target.value })}><option>25</option><option>50</option><option>100</option></select></div>
            </div>
            <div className="field" style={{ marginTop: 10 }}><label className="field-label">Segmento (opcional)</label><input className="field-input" value={filters.industry} onChange={e => setFilters({ ...filters, industry: e.target.value })} placeholder="Ex: varejo, saúde, indústria..." /></div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={realSearch} disabled={searching}>
              <Icon d={ICONS.search2} />{searching ? 'Buscando...' : 'Buscar via Apollo.io'}
            </button>
          </div>
          {apolloResults.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{apolloResults.length} resultado(s)</strong>
                <button className="btn btn-primary btn-sm" onClick={() => onImport(apolloResults)}><Icon d={ICONS.download} />Importar todos</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {apolloResults.map((r, i) => (
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
        </div>
      )}

      {/* ── Aba Importar planilha ── */}
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
            <div className="field"><label className="field-label">Etapa do Funil</label><select className="field-select" value={normalizeStatus(f.status || 'prospeccao')} onChange={e => set('status', e.target.value)}>{FUNNEL.map(fu => <option key={fu.id} value={fu.id}>{fu.label}</option>)}</select></div>
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

// ── Google Sheets Integration View ──────────────────────────────────────────
function SheetsView({ workspace, workspaceName, onImport, showToast }: any) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sheetId, setSheetId] = useState('1iKPPIP3q6lgh4CQuHBH0frIMLOnd3MpAKXsjvwU9EuY');
  const [selectedTab, setSelectedTab] = useState('all');

  const TABS = [
    { id: 'all', label: 'Todas as abas' },
    { id: '2026', label: '2026' },
    { id: 'SMB', label: 'SMB' },
    { id: 'Novos 2026', label: 'Novos 2026' },
  ];

  const doImport = async (action: 'import' | 'sync') => {
    if (action === 'import') setLoading(true);
    else setSyncing(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ workspace, action, tab: selectedTab });
      const r = await fetch(`/api/sheets?${params}`);
      const j = await r.json();
      setResult(j);
      if (j.ok && j.totalImported > 0) {
        // Recarregar leads após importação
        const lr = await fetch(`/api/leads?workspace=${workspace}`);
        const lj = await lr.json();
        if (lj.leads) onImport(lj.leads);
        showToast(`✅ ${j.totalImported} lead(s) importado(s) do Google Sheets`);
      } else if (j.ok && j.totalImported === 0) {
        showToast('Nenhum lead novo encontrado (todos já existem no CRM)');
      }
    } catch (e) {
      setResult({ ok: false, error: String(e) });
      showToast('Erro ao importar do Google Sheets');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const r = await fetch(`/api/sheets?workspace=${workspace}&action=export`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${workspaceName || workspace}_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ Leads exportados com sucesso!');
    } catch {
      showToast('Erro ao exportar leads');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Google Sheets</div>
          <div className="page-description">{workspaceName} · Importar, sincronizar e exportar leads</div>
        </div>
      </div>

      {/* Planilha configurada */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text)' }}>📋 Planilha Conectada</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ID da Planilha Google Sheets</label>
            <input
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace' }}
              value={sheetId}
              onChange={e => setSheetId(e.target.value)}
              placeholder="ID da planilha do Google Sheets"
            />
          </div>
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 20, padding: '8px 14px', background: '#0f9d58', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            🔗 Abrir Planilha
          </a>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          ✅ Planilha pública detectada — importação disponível sem autenticação
        </div>
      </div>

      {/* Seletor de aba */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text)' }}>📑 Selecionar Aba</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTab(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: selectedTab === t.id ? '#0066ff' : 'var(--bg)',
                color: selectedTab === t.id ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${selectedTab === t.id ? '#0066ff' : 'var(--border)'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {/* Importar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Importar Leads</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Importa leads novos da planilha para o CRM. Duplicatas são ignoradas automaticamente.
          </div>
          <button
            onClick={() => doImport('import')}
            disabled={loading}
            style={{ width: '100%', padding: '10px', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '⏳ Importando...' : '📥 Importar Agora'}
          </button>
        </div>

        {/* Sincronizar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔄</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Sincronizar</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Atualiza leads existentes e importa novos. Mantém o CRM sempre em dia com a planilha.
          </div>
          <button
            onClick={() => doImport('sync')}
            disabled={syncing}
            style={{ width: '100%', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1 }}
          >
            {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
          </button>
        </div>

        {/* Exportar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Exportar Leads</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Exporta todos os leads do CRM para um arquivo CSV pronto para importar no Google Sheets.
          </div>
          <button
            onClick={doExport}
            disabled={exporting}
            style={{ width: '100%', padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1 }}
          >
            {exporting ? '⏳ Exportando...' : '📤 Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div style={{ background: result.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: result.ok ? '#15803d' : '#dc2626', marginBottom: 8 }}>
            {result.ok ? '✅ Concluído' : '❌ Erro'}
          </div>
          {result.message && <div style={{ fontSize: 13, color: result.ok ? '#166534' : '#991b1b', marginBottom: 8 }}>{result.message}</div>}
          {result.results && result.results.map((r: any) => (
            <div key={r.tab} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <strong>{r.tab}:</strong> {r.imported} importado(s), {r.skipped} ignorado(s)
              {r.errors?.length > 0 && <span style={{ color: '#dc2626' }}> · {r.errors.length} erro(s)</span>}
            </div>
          ))}
          {result.error && <div style={{ fontSize: 12, color: '#dc2626' }}>{result.error}</div>}
        </div>
      )}

      {/* Instrução de uso */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📖 Como usar</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p><strong>1. Importar:</strong> Clique em "Importar Agora" para trazer todos os leads da planilha para o CRM. Duplicatas são detectadas automaticamente pelo e-mail ou nome da empresa.</p>
          <p><strong>2. Sincronizar:</strong> Use quando adicionar novos leads na planilha — o CRM vai buscar apenas os novos e atualizar os existentes.</p>
          <p><strong>3. Exportar:</strong> Baixa um CSV com todos os leads do CRM no workspace atual, pronto para colar no Google Sheets.</p>
          <p><strong>Colunas suportadas:</strong> Empresa, Nome Contato, Cargo, Telefone, Tel. Empresa, E-mail, Status</p>
          <p><strong>Status mapeados:</strong> Perdido → Prospecção · Fechado → Fechamento · Apresentação → Apresentação · Qualificação → Qualificação</p>
        </div>
      </div>
    </div>
  );
}
