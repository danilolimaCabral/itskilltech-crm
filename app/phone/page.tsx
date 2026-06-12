'use client';
export const dynamic = 'force-dynamic';
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PhonePage() {
  const router = useRouter()

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Top bar */}
      <div style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>← Voltar ao CRM</a>
        <span style={{ color: '#334155' }}>|</span>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>📞 Softphone WebRTC — BrDid (41) 3798-8945</span>
      </div>

      {/* Aviso do ticket */}
      <div style={{
        background: '#fef3c7',
        border: '1px solid #fbbf24',
        color: '#92400e',
        padding: '8px 16px',
        fontSize: 12,
        textAlign: 'center',
        flexShrink: 0
      }}>
        ⚠️ <strong>Aguardando liberação do WebSocket pelo BrDid</strong> — Ticket #703854 aberto em 10/06/2026.
        Quando o BrDid habilitar o WebSocket, o softphone conectará automaticamente com o número <strong>(41) 3798-8945</strong>.
      </div>

      {/* Browser-Phone via iframe */}
      <iframe
        src="/phone/index.html"
        style={{
          flex: 1,
          border: 'none',
          width: '100%'
        }}
        allow="microphone; camera; autoplay"
        title="Softphone WebRTC"
      />
    </div>
  )
}
