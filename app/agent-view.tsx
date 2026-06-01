'use client';
import { useState, useEffect, useRef } from 'react';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);

const ICONS: any = {
  play:    '<polygon points="5 3 19 12 5 21 5 3"/>',
  stop:    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  save:    '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  bot:     '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>',
  check:   '<polyline points="20 6 9 17 4 12"/>',
  email:   '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  clock:   '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  zap:     '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  list:    '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
};

const SEGMENTS = [
  { value: 'logistica',   label: '🚚 Logística e Armazenagem' },
  { value: 'transporte',  label: '🚛 Transporte de Cargas' },
  { value: 'tms',         label: '📦 TMS / Gestão de Frota' },
  { value: 'atacado',     label: '🏪 Atacado e Distribuição' },
  { value: 'industria',   label: '🏭 Indústria' },
  { value: 'tecnologia',  label: '💻 Tecnologia / TI' },
  { value: 'software',    label: '⚙️ Software / SaaS' },
  { value: 'saude',       label: '🏥 Saúde' },
  { value: 'varejo',      label: '🛒 Varejo' },
  { value: 'construcao',  label: '🏗️ Construção Civil' },
  { value: 'agro',        label: '🌾 Agronegócio' },
  { value: 'financeiro',  label: '💰 Financeiro' },
  { value: 'educacao',    label: '🎓 Educação' },
  { value: 'alimentos',   label: '🍽️ Alimentos e Bebidas' },
];

export function AgentView({ workspace, workspaceName, showToast }: { workspace: string; workspaceName?: string; showToast: (m: string) => void }) {
  const [config, setConfig] = useState<any>({
    workspace, enabled: false, industry: 'logistica', source: 'cnpja,apollo',
    daily_limit: 10, send_email: true, email_template: '', email_subject: '',
  });
  const [sources, setSources] = useState({ cnpja: false, apollo: false, resend: false });
  const [runs, setRuns] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [tab, setTab] = useState<'config' | 'history' | 'log'>('config');
  const [saving, setSaving] = useState(false);
  const [lastRun, setLastRun] = useState<any>(null);
  const [cronStatus, setCronStatus] = useState<'active' | 'inactive'>('inactive');
  const logRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/auto-prospect?workspace=${workspace}`);
      const j = await r.json();
      if (j.config) setConfig({ ...j.config, workspace });
      if (j.runs) { setRuns(j.runs); if (j.runs[0]) setLastRun(j.runs[0]); }
      if (j.sources) setSources(j.sources);
    if (j.config?.enabled) setCronStatus('active');
    else setCronStatus('inactive');
    } catch {}
  };

  useEffect(() => { load(); }, [workspace]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [runLog]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/auto-prospect', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, workspace }),
      });
      showToast('✓ Configurações salvas');
    } catch { showToast('Erro ao salvar'); }
    setSaving(false);
  };

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setRunLog(['Iniciando agente de prospecção...']);
    setTab('log');
    try {
      const r = await fetch('/api/auto-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, workspace, wsName: workspaceName || 'getLOG/Lottustech', force: true }),
      });
      const j = await r.json();
      if (j.log) setRunLog(Array.isArray(j.log) ? j.log : j.log.split('\n'));
      if (j.ok) {
        showToast(`✓ Agente concluído — ${j.leads_imported} leads importados, ${j.emails_sent} e-mails enviados`);
      } else {
        showToast('Erro no agente: ' + (j.error || 'tente novamente'));
      }
      await load();
    } catch (e: any) {
      setRunLog(prev => [...prev, '✗ Erro: ' + e.message]);
      showToast('Erro ao executar agente');
    }
    setRunning(false);
  };

  const activeSources = [
    sources.cnpja && 'CNPJ.já',
    sources.apollo && 'Apollo.io',
  ].filter(Boolean);

  const segLabel = SEGMENTS.find(s => s.value === config.industry)?.label || config.industry;

  // Próxima execução automática (próximo dia útil às 9h BRT)
  const nextRun = (() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);
    if (next <= now || now.getDay() === 0 || now.getDay() === 6) {
      next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    }
    return next.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header do Agente */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: 14, padding: '24px 28px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} width={28} height={28} dangerouslySetInnerHTML={{ __html: ICONS.bot }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Agente de Prospecção</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Busca e contata leads automaticamente todo dia útil</div>
          </div>
          {/* Toggle ligado/desligado */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, opacity: 0.9 }}>{config.enabled ? 'Ativo' : 'Inativo'}</span>
            <div
              onClick={() => setConfig((c: any) => ({ ...c, enabled: !c.enabled }))}
              style={{
                width: 52, height: 28, borderRadius: 14, cursor: 'pointer', transition: 'background .2s',
                background: config.enabled ? '#22c55e' : 'rgba(255,255,255,0.3)',
                position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: config.enabled ? 27 : 3,
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </div>
          </div>
        </div>
        {/* Badge cron status */}
        {config.enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.2)', borderRadius: 20, padding: '4px 12px', marginBottom: 12, width: 'fit-content' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 12, color: '#bbf7d0', fontWeight: 600 }}>Cron ativo — próxima execução: {nextRun}</span>
          </div>
        )}
        {/* Resumo rápido */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Segmento', value: segLabel },
            { label: 'Limite diário', value: `${config.daily_limit} leads` },
            { label: 'Fontes ativas', value: activeSources.length ? activeSources.join(' + ') : 'Nenhuma configurada' },
            { label: 'E-mail automático', value: config.send_email && sources.resend ? 'Ativo' : 'Inativo' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 14px', minWidth: 120 }}>
              <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão executar agora */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, justifyContent: 'center', gap: 8, padding: '12px 20px', fontSize: 15, fontWeight: 600 }}
          onClick={runNow}
          disabled={running}
        >
          {running
            ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />Executando...</>
            : <><Icon d={ICONS.play} />Executar Agora</>
          }
        </button>
        <button className="btn" onClick={save} disabled={saving} style={{ padding: '12px 18px' }}>
          <Icon d={ICONS.save} />{saving ? 'Salvando...' : 'Salvar Config'}
        </button>
        <button className="btn" onClick={load} style={{ padding: '12px 14px' }}>
          <Icon d={ICONS.refresh} />
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['config', '⚙️ Configuração'], ['history', '📋 Histórico'], ['log', '📟 Log']] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: tab === t ? 700 : 400, borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent', background: 'none', cursor: 'pointer', color: tab === t ? 'var(--primary)' : 'var(--text-muted)', transition: 'all .15s' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Aba: Configuração */}
      {tab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status das fontes */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Fontes Disponíveis</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'cnpja', label: 'CNPJ.já', desc: 'Dados oficiais da Receita Federal', ok: sources.cnpja },
                { key: 'apollo', label: 'Apollo.io', desc: 'Base global de empresas B2B', ok: sources.apollo },
                { key: 'resend', label: 'Resend (e-mail)', desc: 'Envio automático de e-mails', ok: sources.resend },
              ].map(({ key, label, desc, ok }) => (
                <div key={key} style={{ flex: '1 1 180px', background: 'var(--surface)', borderRadius: 8, padding: '10px 14px', border: `1.5px solid ${ok ? '#22c55e' : 'var(--border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#22c55e' : '#d1d5db' }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: ok ? '#16a34a' : '#9ca3af' }}>{ok ? 'Configurado' : 'Não configurado'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              ))}
            </div>
            {!sources.cnpja && !sources.apollo && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                ⚠️ Configure pelo menos uma fonte nas variáveis de ambiente da Vercel: <code>CNPJA_API_KEY</code> ou <code>APOLLO_API_KEY</code>
              </div>
            )}
          </div>

          {/* Segmento */}
          <div className="field">
            <label className="field-label">Segmento de Prospecção</label>
            <select className="field-input" value={config.industry} onChange={e => setConfig((c: any) => ({ ...c, industry: e.target.value }))}>
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>O agente buscará empresas deste segmento por CNAE (Receita Federal)</div>
          </div>

          {/* Fontes */}
          <div className="field">
            <label className="field-label">Fontes de Dados</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { value: 'cnpja', label: 'CNPJ.já', available: sources.cnpja },
                { value: 'apollo', label: 'Apollo.io', available: sources.apollo },
              ].map(({ value, label, available }) => {
                const selected = (config.source || '').includes(value);
                return (
                  <button key={value}
                    onClick={() => {
                      if (!available) return;
                      const parts = (config.source || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      const next = selected ? parts.filter((p: string) => p !== value) : [...parts, value];
                      setConfig((c: any) => ({ ...c, source: next.join(',') || 'cnpja' }));
                    }}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: available ? 'pointer' : 'not-allowed',
                      border: `1.5px solid ${selected && available ? 'var(--primary)' : 'var(--border)'}`,
                      background: selected && available ? 'var(--primary)' : 'var(--surface)',
                      color: selected && available ? '#fff' : available ? 'var(--text)' : 'var(--text-muted)',
                      opacity: available ? 1 : 0.5,
                    }}>
                    {label} {!available && '(sem chave)'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Limite diário */}
          <div className="field">
            <label className="field-label">Leads por execução: <strong>{config.daily_limit}</strong></label>
            <input type="range" min={1} max={50} value={config.daily_limit}
              onChange={e => setConfig((c: any) => ({ ...c, daily_limit: parseInt(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--primary)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>1 lead</span><span>25 leads</span><span>50 leads</span>
            </div>
          </div>

          {/* Enviar e-mail automático */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Enviar e-mail automático</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {sources.resend ? 'A IA gera um e-mail personalizado para cada lead e envia automaticamente' : '⚠️ Configure RESEND_API_KEY para habilitar'}
              </div>
            </div>
            <div
              onClick={() => { if (sources.resend) setConfig((c: any) => ({ ...c, send_email: !c.send_email })); }}
              style={{
                width: 48, height: 26, borderRadius: 13, cursor: sources.resend ? 'pointer' : 'not-allowed',
                background: config.send_email && sources.resend ? 'var(--primary)' : 'var(--border)',
                position: 'relative', flexShrink: 0, transition: 'background .2s', opacity: sources.resend ? 1 : 0.5,
              }}>
              <div style={{
                position: 'absolute', top: 3, left: config.send_email && sources.resend ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </div>
          </div>

          {/* Template personalizado */}
          {config.send_email && sources.resend && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--surface-2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Template de E-mail (opcional)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Se vazio, a IA gera um e-mail único e personalizado para cada empresa. Use variáveis: <code>{'{{nome}}'}</code>, <code>{'{{empresa}}'}</code>, <code>{'{{cargo}}'}</code>, <code>{'{{segmento}}'}</code>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Assunto padrão</label>
                <input className="field-input" placeholder="Ex: Solução TMS para {{empresa}}" value={config.email_subject || ''} onChange={e => setConfig((c: any) => ({ ...c, email_subject: e.target.value }))} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Corpo do e-mail</label>
                <textarea className="field-textarea" style={{ minHeight: 120 }} placeholder="Olá {{nome}}, tudo bem?&#10;&#10;Meu nome é Danilo, da getLOG/Lottustech..." value={config.email_template || ''} onChange={e => setConfig((c: any) => ({ ...c, email_template: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Info sobre agendamento */}
          <div style={{ padding: '14px 16px', background: config.enabled ? '#f0fdf4' : '#eff6ff', borderRadius: 10, border: `1px solid ${config.enabled ? '#bbf7d0' : '#bfdbfe'}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={config.enabled ? '#16a34a' : '#3b82f6'} strokeWidth={2} width={18} height={18} style={{ flexShrink: 0, marginTop: 1 }} dangerouslySetInnerHTML={{ __html: ICONS.clock }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: config.enabled ? '#15803d' : '#1e40af' }}>
                  {config.enabled ? '✅ Cron Job ativo — rodando dentro do CRM' : '⏰ Agendamento automático (inativo)'}
                </div>
                <div style={{ fontSize: 12, color: config.enabled ? '#166534' : '#1d4ed8', marginTop: 3 }}>
                  {config.enabled
                    ? <>A IA executa automaticamente <strong>todo dia útil às 9h (BRT)</strong>: busca empresas no CNPJ.já, analisa cada uma, gera e-mail personalizado e envia. Próxima execução: <strong>{nextRun}</strong>.</>
                    : <>Ative o agente acima para habilitar o cron job. Ele rodará automaticamente <strong>todo dia útil às 9h</strong> diretamente dentro do CRM, sem precisar de nada externo.</>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aba: Histórico */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma execução ainda</div>
              <div style={{ fontSize: 13 }}>Clique em "Executar Agora" para iniciar a primeira prospecção</div>
            </div>
          ) : runs.map((run: any) => {
            const statusColors: any = { done: '#22c55e', error: '#ef4444', running: '#f59e0b' };
            const statusLabels: any = { done: '✅ Concluído', error: '❌ Erro', running: '⏳ Executando' };
            const duration = run.finished_at ? Math.round((run.finished_at - run.started_at) / 1000) : null;
            return (
              <div key={run.id} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px', border: `1px solid ${statusColors[run.status] || 'var(--border)'}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColors[run.status] || 'var(--text-muted)' }}>{statusLabels[run.status] || run.status}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {new Date(run.started_at).toLocaleString('pt-BR')}
                    {duration ? ` · ${duration}s` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Encontrados', value: run.leads_found, color: '#6366f1' },
                    { label: 'Importados', value: run.leads_imported, color: '#3b82f6' },
                    { label: 'E-mails', value: run.emails_sent, color: '#10b981' },
                    { label: 'Erros', value: run.errors, color: run.errors > 0 ? '#ef4444' : '#9ca3af' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center', minWidth: 60 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aba: Log */}
      {tab === 'log' && (
        <div>
          {runLog.length === 0 && !running ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📟</div>
              <div style={{ fontSize: 13 }}>O log aparece aqui durante e após a execução</div>
            </div>
          ) : (
            <div ref={logRef} style={{ background: '#0f172a', borderRadius: 10, padding: '16px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', maxHeight: 400, overflowY: 'auto', lineHeight: 1.7 }}>
              {runLog.map((line, i) => {
                const color = line.includes('✓') || line.includes('✅') ? '#4ade80'
                  : line.includes('✗') || line.includes('❌') ? '#f87171'
                  : line.includes('✉') ? '#60a5fa'
                  : line.includes('⚠') ? '#fbbf24'
                  : '#94a3b8';
                return <div key={i} style={{ color }}>{line}</div>;
              })}
              {running && <div style={{ color: '#fbbf24', animation: 'pulse 1s infinite' }}>▌</div>}
            </div>
          )}
          {lastRun && lastRun.log && runLog.length === 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Último log ({new Date(lastRun.started_at).toLocaleString('pt-BR')}):</div>
              <div style={{ background: '#0f172a', borderRadius: 10, padding: '16px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', maxHeight: 300, overflowY: 'auto', lineHeight: 1.7 }}>
                {lastRun.log.split('\n').map((line: string, i: number) => {
                  const color = line.includes('✓') || line.includes('✅') ? '#4ade80'
                    : line.includes('✗') || line.includes('❌') ? '#f87171'
                    : line.includes('✉') ? '#60a5fa'
                    : line.includes('⚠') ? '#fbbf24'
                    : '#94a3b8';
                  return <div key={i} style={{ color }}>{line}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
