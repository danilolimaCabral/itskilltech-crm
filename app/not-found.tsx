export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: 18, color: '#94a3b8', marginBottom: 24 }}>Página não encontrada</p>
      <a href="/" style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Voltar ao CRM</a>
    </div>
  );
}
