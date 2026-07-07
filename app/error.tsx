'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>Erro</h1>
      <p style={{ fontSize: 18, color: '#94a3b8', marginBottom: 24 }}>Ocorreu um erro inesperado no CRM.</p>
      <button onClick={() => reset()} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer' }}>Tentar novamente</button>
    </div>
  );
}
