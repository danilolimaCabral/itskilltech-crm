'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.message || 'Usuário ou senha incorretos.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const body = recoveryToken
        ? { action: 'reset', recoveryToken, password: newPassword }
        : { action: 'verify', username, code: recoveryCode };
      const res = await fetch('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível recuperar o acesso.');
      if (recoveryToken) {
        setRecoveryMode(false); setRecoveryToken(''); setRecoveryCode(''); setNewPassword('');
        setError('Senha redefinida. Faça login com a nova senha.');
      } else {
        setRecoveryToken(data.recoveryToken);
      }
    } catch (err: any) { setError(err.message || 'Erro de conexão.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f1923 0%, #1a2332 50%, #0f1923 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#2ecc71',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1rem',
            boxShadow: '0 0 30px rgba(46,204,113,0.3)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
            </svg>
          </div>
          <h1 style={{ color: 'white', fontSize: '2.2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
            get<span style={{ color: '#2ecc71' }}>LOG</span>
          </h1>
          <p style={{ color: '#6b7a8d', fontSize: '0.85rem', marginTop: '0.25rem' }}>logística inteligente</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#1e2d3d',
          borderRadius: '1.25rem',
          padding: '2rem',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
            Acesso Restrito
          </h2>
          <p style={{ color: '#6b7a8d', fontSize: '0.875rem', margin: '0 0 1.5rem 0' }}>
            Insira suas credenciais para acessar o CRM.
          </p>

          <form onSubmit={handleLogin}>
            {/* Usuário */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#a0aec0', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  background: '#0f1923',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  color: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#2ecc71'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#a0aec0', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    background: '#0f1923',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 3rem 0.75rem 1rem',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2ecc71'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7a8d',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPass ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#ef4444">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</span>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#27ae60' : '#2ecc71',
                color: 'white',
                fontWeight: 600,
                fontSize: '1rem',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, transform 0.1s',
                boxShadow: '0 4px 15px rgba(46,204,113,0.25)',
                opacity: loading ? 0.8 : 1,
              }}
              onMouseDown={(e) => { (e.target as HTMLButtonElement).style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { (e.target as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              {loading ? 'Entrando...' : 'Acessar CRM'}
            </button>
          </form>

          <button type="button" onClick={() => { setRecoveryMode(!recoveryMode); setError(''); }} style={{ width: '100%', marginTop: '1rem', background: 'transparent', border: 'none', color: '#8fa3b8', cursor: 'pointer', fontSize: '0.85rem' }}>
            {recoveryMode ? 'Voltar ao login' : 'Esqueci minha senha'}
          </button>

          {recoveryMode && (
            <form onSubmit={handleRecovery} style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <p style={{ color: '#8fa3b8', fontSize: '0.8rem', margin: '0 0 1rem' }}>
                {recoveryToken ? 'Digite uma nova senha com pelo menos 10 caracteres.' : 'Informe seu usuário e o código temporário fornecido pelo administrador.'}
              </p>
              {!recoveryToken && <input type="text" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} placeholder="Código temporário" required style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem', background: '#0f1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'white' }} />}
              {recoveryToken && <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nova senha" minLength={10} required style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem', background: '#0f1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'white' }} />}
              <button type="submit" disabled={loading} style={{ width: '100%', background: '#34495e', color: 'white', fontWeight: 600, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Validando...' : recoveryToken ? 'Definir nova senha' : 'Validar código'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#3d4f63', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          © 2026 getLOG / Danilo Lottustech — Acesso Restrito
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f1923' }} />}>
      <LoginForm />
    </Suspense>
  );
}
