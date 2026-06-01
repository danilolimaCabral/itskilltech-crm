import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Z-API: https://developer.z-api.io ────────────────────────────────────────
// Variáveis de ambiente necessárias na Vercel:
//   ZAPI_INSTANCE_ID   — ID da instância (ex: 3D5C0B1234...)
//   ZAPI_TOKEN         — Token da instância
//   ZAPI_CLIENT_TOKEN  — Client-Token da conta Z-API
const ZAPI_ID     = process.env.ZAPI_INSTANCE_ID || '';
const ZAPI_TOKEN  = process.env.ZAPI_TOKEN || '';
const ZAPI_CLIENT = process.env.ZAPI_CLIENT_TOKEN || '';
const BASE        = `https://api.z-api.io/instances/${ZAPI_ID}/token/${ZAPI_TOKEN}`;

// ── Formatar número para WhatsApp (formato internacional sem +) ───────────────
function formatPhone(phone: string): string {
  let num = phone.replace(/\D/g, '');
  if (num.startsWith('0')) num = num.slice(1);
  if (num.length <= 11) num = '55' + num;
  return num;
}

// ── Headers padrão Z-API ──────────────────────────────────────────────────────
function zapiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ZAPI_CLIENT) h['Client-Token'] = ZAPI_CLIENT;
  return h;
}

// ── GET: status da instância ou QR Code ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'status';

  if (!ZAPI_ID || !ZAPI_TOKEN) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Z-API não configurada. Acesse app.z-api.io, crie uma instância e adicione ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nas variáveis de ambiente da Vercel.',
      setupUrl: 'https://app.z-api.io',
    });
  }

  try {
    if (action === 'qrcode') {
      const res = await fetch(`${BASE}/qr-code/image`, { headers: zapiHeaders() });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, ...data });
    }

    if (action === 'disconnect') {
      const res = await fetch(`${BASE}/disconnect`, { method: 'DELETE', headers: zapiHeaders() });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, ...data });
    }

    if (action === 'restart') {
      const res = await fetch(`${BASE}/restart`, { method: 'PUT', headers: zapiHeaders() });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, ...data });
    }

    // Status padrão
    const res = await fetch(`${BASE}/status`, { headers: zapiHeaders() });
    const data = await res.json();
    const connected = data?.connected === true || data?.status === 'CONNECTED';
    return NextResponse.json({
      ok: res.ok,
      configured: true,
      connected,
      status: connected ? 'CONNECTED' : (data?.status || 'DISCONNECTED'),
      phone: data?.phone || null,
      raw: data,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ── POST: enviar mensagem WhatsApp ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, message, leadName, companyName, action = 'send-text' } = body;

  if (!ZAPI_ID || !ZAPI_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Z-API não configurada. Adicione ZAPI_INSTANCE_ID e ZAPI_TOKEN nas variáveis de ambiente da Vercel.' }, { status: 503 });
  }

  if (!phone) {
    return NextResponse.json({ ok: false, error: 'Número de telefone obrigatório' }, { status: 400 });
  }

  const formattedPhone = formatPhone(phone);

  try {
    if (action === 'send-link') {
      // Mensagem com link preview
      const res = await fetch(`${BASE}/send-link`, {
        method: 'POST',
        headers: zapiHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          message: message || `Olá ${leadName || ''}! 👋 Sou Danilo da getLOG/Lottustech. Preparei uma apresentação da nossa solução TMS para ${companyName || 'vocês'}:`,
          linkUrl: 'https://www.gettms.com.br',
          title: 'getLOG/Lottustech — TMS para Logística',
          linkDescription: 'Sistema de Gestão de Transporte para otimizar sua operação logística.',
        }),
      });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, messageId: data.zaapId || data.id, ...data });
    }

    if (action === 'send-button') {
      // Mensagem com botões de ação rápida
      const res = await fetch(`${BASE}/send-button-list`, {
        method: 'POST',
        headers: zapiHeaders(),
        body: JSON.stringify({
          phone: formattedPhone,
          message: message || `Olá ${leadName || ''}! 👋\n\nSou Danilo da *getLOG/Lottustech*.\n\nVi que a *${companyName || 'sua empresa'}* atua no segmento de logística e acredito que nossa solução TMS pode otimizar a operação de vocês.\n\nPosso te mostrar em 15 minutos os resultados que estamos gerando?`,
          buttonList: {
            buttons: [
              { id: '1', label: '✅ Sim, quero conhecer!' },
              { id: '2', label: '📅 Agendar para outro dia' },
              { id: '3', label: '❌ Não tenho interesse' },
            ],
          },
        }),
      });
      const data = await res.json();
      return NextResponse.json({ ok: res.ok, messageId: data.zaapId || data.id, ...data });
    }

    // Padrão: enviar texto simples
    const text = message || `Olá ${leadName || ''}! Tudo bem? 😊\n\nSou Danilo da *getLOG/Lottustech*. Vi que a *${companyName || 'sua empresa'}* pode se beneficiar da nossa solução TMS para gestão de transporte.\n\nPosso apresentar em 15 minutos? 🚀\n\nwww.gettms.com.br`;

    const res = await fetch(`${BASE}/send-text`, {
      method: 'POST',
      headers: zapiHeaders(),
      body: JSON.stringify({ phone: formattedPhone, message: text }),
    });
    const data = await res.json();
    return NextResponse.json({
      ok: res.ok,
      messageId: data.zaapId || data.id,
      message: res.ok ? `WhatsApp enviado para ${leadName || formattedPhone}` : (data?.error || 'Erro ao enviar'),
      ...data,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
