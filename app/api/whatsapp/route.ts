import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EVO_URL = process.env.EVOLUTION_API_URL || '';
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'crm';

// ── Formatar número para WhatsApp (formato internacional sem +) ───────────────
function formatPhone(phone: string): string {
  // Remove tudo que não é número
  let num = phone.replace(/\D/g, '');
  // Se começa com 0, remove
  if (num.startsWith('0')) num = num.slice(1);
  // Se não tem DDI (menos de 12 dígitos), adiciona 55 (Brasil)
  if (num.length <= 11) num = '55' + num;
  return num;
}

// ── GET: status da instância do WhatsApp ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'status';

  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Evolution API não configurada. Adicione EVOLUTION_API_URL e EVOLUTION_API_KEY nas variáveis de ambiente da Vercel.',
    });
  }

  try {
    if (action === 'qrcode') {
      // Buscar QR Code para conectar
      const res = await fetch(`${EVO_URL}/instance/connect/${EVO_INSTANCE}`, {
        headers: { apikey: EVO_KEY },
      });
      if (!res.ok) {
        // Tentar criar a instância primeiro
        const createRes = await fetch(`${EVO_URL}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
          body: JSON.stringify({
            instanceName: EVO_INSTANCE,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });
        const createData = await createRes.json();
        return NextResponse.json({
          ok: true,
          action: 'created',
          qrcode: createData?.qrcode?.base64 || createData?.base64 || null,
          pairingCode: createData?.qrcode?.pairingCode || null,
          data: createData,
        });
      }
      const data = await res.json();
      return NextResponse.json({
        ok: true,
        action: 'connect',
        qrcode: data?.base64 || data?.qrcode?.base64 || null,
        pairingCode: data?.pairingCode || null,
        data,
      });
    }

    // Status padrão
    const res = await fetch(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, {
      headers: { apikey: EVO_KEY },
    });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        configured: true,
        connected: false,
        state: 'not_found',
        message: 'Instância não encontrada. Clique em "Conectar WhatsApp" para criar.',
      });
    }

    const data = await res.json();
    const state = data?.instance?.state || data?.state || 'unknown';
    const connected = state === 'open';

    return NextResponse.json({
      ok: true,
      configured: true,
      connected,
      state,
      instance: EVO_INSTANCE,
      message: connected ? 'WhatsApp conectado e pronto para envio' : `Status: ${state}`,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      configured: true,
      connected: false,
      error: e.message,
    });
  }
}

// ── POST: enviar mensagem WhatsApp ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, message, leadName, action } = body;

  if (!EVO_URL || !EVO_KEY) {
    return NextResponse.json({ ok: false, error: 'Evolution API não configurada' }, { status: 503 });
  }

  // Ação especial: criar instância
  if (action === 'create_instance') {
    try {
      const res = await fetch(`${EVO_URL}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
        body: JSON.stringify({
          instanceName: EVO_INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
      const data = await res.json();
      return NextResponse.json({
        ok: res.ok,
        qrcode: data?.qrcode?.base64 || data?.base64 || null,
        pairingCode: data?.qrcode?.pairingCode || null,
        data,
      });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
  }

  if (!phone || !message) {
    return NextResponse.json({ ok: false, error: 'phone e message são obrigatórios' }, { status: 400 });
  }

  const number = formatPhone(phone);

  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text: message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({
        ok: false,
        error: err?.message || `Erro ${res.status}`,
        details: err,
      }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      ok: true,
      message: `WhatsApp enviado para ${leadName || number}`,
      data,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
