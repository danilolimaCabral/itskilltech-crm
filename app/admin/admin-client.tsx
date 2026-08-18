'use client';

import { FormEvent, useEffect, useState } from 'react';

type Workspace = {
  id: string;
  name: string;
  color: string;
  company_name?: string;
  company_cnpj?: string;
  status?: string;
  plan?: string;
};

type TenantUser = {
  id: string;
  username: string;
  display_name: string;
  workspace: string;
  workspace_name?: string;
  role: string;
  active: boolean;
};

const emptyClient = { name: '', company_name: '', company_cnpj: '', color: '#2563eb' };
const emptyUser = { display_name: '', username: '', password: '', workspace: 'iota' };

export default function AdminClient() {
  const [ready, setReady] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [userForm, setUserForm] = useState(emptyUser);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<'client' | 'user' | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const loadData = async () => {
    const [workspaceResponse, usersResponse] = await Promise.all([
      fetch('/api/workspaces'),
      fetch('/api/admin/users'),
    ]);
    const workspaceData = await workspaceResponse.json();
    const usersData = await usersResponse.json();
    if (!workspaceResponse.ok || !usersResponse.ok) throw new Error('Não foi possível carregar o painel administrativo.');
    setWorkspaces(workspaceData.workspaces || []);
    setUsers(usersData.users || []);
  };

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (!response.ok || data.session?.role !== 'master') {
          window.location.assign('/');
          return;
        }
        await loadData();
        setReady(true);
      } catch {
        window.location.assign('/login?redirect=/admin');
      }
    })();
  }, []);

  const createClient = async (event: FormEvent) => {
    event.preventDefault();
    const name = clientForm.name.trim();
    const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36);
    if (!id) return flash('Informe um nome de cliente válido.');
    setSaving('client');
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...clientForm, name, company_name: clientForm.company_name.trim(), company_cnpj: clientForm.company_cnpj.trim(), status: 'active', plan: 'starter' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível cadastrar o cliente.');
      setClientForm(emptyClient);
      await loadData();
      flash(`${name} foi cadastrado como novo cliente.`);
    } catch (error: any) {
      flash(error.message || 'Erro ao cadastrar cliente.');
    }
    setSaving(null);
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setSaving('user');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar o acesso.');
      setUserForm({ ...emptyUser, workspace: userForm.workspace });
      await loadData();
      flash(`Acesso de ${data.user.display_name} criado para ${data.user.workspace}.`);
    } catch (error: any) {
      flash(error.message || 'Erro ao criar acesso.');
    }
    setSaving(null);
  };

  if (!ready) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f8fb', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>Validando acesso administrativo...</main>;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f7f8fb', color: '#172033', fontFamily: 'Arial, sans-serif', padding: '28px 18px 48px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <header style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2563eb', fontWeight: 800, letterSpacing: '.04em', fontSize: 12, textTransform: 'uppercase' }}>ITSkillTech CRM · Administração mestre</div>
            <h1 style={{ margin: '8px 0 6px', fontSize: 30, letterSpacing: '-.035em' }}>Clientes, workspaces e acessos</h1>
            <p style={{ maxWidth: 680, margin: 0, color: '#64748b', lineHeight: 1.5 }}>Cada empresa recebe uma base isolada. IOTA e SPLITC já estão prontas como workspaces independentes; crie o usuário de cada responsável antes de liberar o acesso.</p>
          </div>
          <a href="/" style={{ whiteSpace: 'nowrap', color: '#2563eb', fontWeight: 700, textDecoration: 'none', padding: '10px 14px', border: '1px solid #bfdbfe', borderRadius: 10, background: '#eff6ff' }}>Voltar ao CRM</a>
        </header>

        {message && <div role="status" style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 10, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 600 }}>{message}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <form onSubmit={createClient} style={{ padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Cadastrar nova empresa</h2>
            <p style={{ margin: '6px 0 18px', fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>Crie o workspace comercial da empresa. Os leads, propostas, templates e atividades ficam separados por esse identificador.</p>
            <Field label="Nome comercial"><input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} required placeholder="Ex.: Transportadora Exemplo" /></Field>
            <Field label="Razão social"><input value={clientForm.company_name} onChange={e => setClientForm({ ...clientForm, company_name: e.target.value })} placeholder="Opcional" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px', gap: 10 }}>
              <Field label="CNPJ"><input value={clientForm.company_cnpj} onChange={e => setClientForm({ ...clientForm, company_cnpj: e.target.value })} placeholder="Opcional" /></Field>
              <Field label="Cor"><input type="color" value={clientForm.color} onChange={e => setClientForm({ ...clientForm, color: e.target.value })} style={{ height: 42, padding: 3 }} /></Field>
            </div>
            <button type="submit" disabled={saving === 'client'} style={primaryButton}>{saving === 'client' ? 'Cadastrando...' : 'Cadastrar empresa'}</button>
          </form>

          <form onSubmit={createUser} style={{ padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Liberar acesso do cliente</h2>
            <p style={{ margin: '6px 0 18px', fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>O operador fica vinculado a uma única empresa e não visualiza nem altera dados de outras bases.</p>
            <Field label="Nome do responsável"><input value={userForm.display_name} onChange={e => setUserForm({ ...userForm, display_name: e.target.value })} required placeholder="Ex.: Maria Silva" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Usuário"><input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s+/g, '.') })} required placeholder="maria.iota" /></Field>
              <Field label="Senha temporária"><input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required minLength={10} placeholder="Mínimo 10 caracteres" /></Field>
            </div>
            <Field label="Empresa"><select value={userForm.workspace} onChange={e => setUserForm({ ...userForm, workspace: e.target.value })}>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></Field>
            <button type="submit" disabled={saving === 'user'} style={primaryButton}>{saving === 'user' ? 'Criando...' : 'Criar acesso isolado'}</button>
          </form>
        </section>

        <section style={{ marginTop: 22, padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Empresas ativas</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginTop: 16 }}>
            {workspaces.map(workspace => <article key={workspace.id} style={{ border: '1px solid #e2e8f0', borderTop: `4px solid ${workspace.color || '#2563eb'}`, borderRadius: 10, padding: 14 }}><strong>{workspace.name}</strong><div style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>{workspace.company_name || 'Razão social não informada'}</div><div style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>Workspace: {workspace.id}{workspace.company_cnpj ? ` · CNPJ: ${workspace.company_cnpj}` : ''}</div></article>)}
          </div>
        </section>

        <section style={{ marginTop: 22, padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Acessos cadastrados</h2>
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={cell}>Responsável</th><th style={cell}>Usuário</th><th style={cell}>Empresa</th><th style={cell}>Perfil</th><th style={cell}>Situação</th></tr></thead><tbody>{users.map(user => <tr key={user.id} style={{ borderTop: '1px solid #eef2f7' }}><td style={cell}><strong>{user.display_name}</strong></td><td style={cell}>@{user.username}</td><td style={cell}>{user.workspace_name || user.workspace}</td><td style={cell}>{user.role === 'master' ? 'Administrador mestre' : 'Operador'}</td><td style={cell}><span style={{ color: user.active ? '#047857' : '#b91c1c', fontWeight: 700 }}>{user.active ? 'Ativo' : 'Inativo'}</span></td></tr>)}</tbody></table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginBottom: 12, color: '#334155', fontWeight: 700, fontSize: 12 }}>{label}<div style={{ marginTop: 6 }}>{children}</div></label>;
}

const primaryButton = { width: '100%', marginTop: 4, padding: '11px 14px', border: 0, borderRadius: 9, background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' } as const;
const cell = { padding: '11px 10px', verticalAlign: 'middle' } as const;
