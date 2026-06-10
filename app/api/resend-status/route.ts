import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

// Busca o status de um e-mail no Resend por ID
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const emailId = searchParams.get('id')
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
  }

  if (!emailId) {
    return NextResponse.json({ error: 'ID do e-mail não informado' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.message || 'Erro ao buscar status', status: res.status }, { status: res.status })
    }

    const data = await res.json()
    // Mapear campos do Resend para formato amigável
    return NextResponse.json({
      ok: true,
      id: data.id,
      to: data.to,
      subject: data.subject,
      from: data.from,
      created_at: data.created_at,
      last_event: data.last_event,
      // Eventos possíveis: sent, delivered, delivery_delayed, bounced, complained, opened, clicked
      status: data.last_event || 'sent',
      opened: ['opened', 'clicked'].includes(data.last_event || ''),
      clicked: data.last_event === 'clicked',
      bounced: data.last_event === 'bounced',
      complained: data.last_event === 'complained',
      error: ['bounced', 'complained'].includes(data.last_event || '') ? data.last_event : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro desconhecido' }, { status: 500 })
  }
}

// Busca status de múltiplos IDs de uma vez (POST com array de IDs)
export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
  }

  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Array de IDs não informado' }, { status: 400 })
    }

    // Buscar em paralelo (máx 20 por vez para não sobrecarregar)
    const batch = ids.slice(0, 20)
    const results = await Promise.allSettled(
      batch.map(id =>
        fetch(`https://api.resend.com/emails/${id}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }).then(r => r.json())
      )
    )

    const statuses: Record<string, any> = {}
    for (let i = 0; i < batch.length; i++) {
      const r = results[i]
      if (r.status === 'fulfilled' && r.value?.id) {
        const d = r.value
        statuses[batch[i]] = {
          id: d.id,
          status: d.last_event || 'sent',
          opened: ['opened', 'clicked'].includes(d.last_event || ''),
          clicked: d.last_event === 'clicked',
          bounced: d.last_event === 'bounced',
          complained: d.last_event === 'complained',
          created_at: d.created_at,
          last_event: d.last_event,
        }
      } else {
        statuses[batch[i]] = { id: batch[i], status: 'unknown', error: true }
      }
    }

    return NextResponse.json({ ok: true, statuses })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro desconhecido' }, { status: 500 })
  }
}
