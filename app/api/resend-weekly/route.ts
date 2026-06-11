import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getLeads } from '@/lib/db'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

interface WorkspaceSender {
  email: string
  name: string
  displayName: string
  contactEmail: string
  phone: string
  color: string
  colorLight: string
}

const WORKSPACE_SENDERS: Record<string, WorkspaceSender> = {
  lottus: {
    email: 'crm@grandy.ia.br',
    name: 'getLOG/Lottustech',
    displayName: 'Danilo Cabral',
    contactEmail: 'danilo@lottustech.com.br',
    phone: '(41) 99949-9815',
    color: '#16a34a',
    colorLight: '#15803d',
  },
}

const DEFAULT_SENDER: WorkspaceSender = WORKSPACE_SENDERS.lottus

// POST /api/resend-weekly
// Reenvia todos os e-mails enviados na semana passada com assunto "Acompanhamento: [original]"
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const workspace = body.workspace || 'lottus'
    const dryRun = body.dry_run === true // se true, só lista sem enviar

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 503 })
    }

    const sender = WORKSPACE_SENDERS[workspace] || DEFAULT_SENDER

    // Janela: e-mails enviados nos últimos 7 dias
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    const leads = await getLeads(workspace)

    const toResend: {
      leadId: string
      leadName: string
      leadEmail: string
      leadCompany: string
      leadRole: string
      originalSubject: string
      originalBody: string
      originalTs: number
    }[] = []

    for (const lead of leads) {
      const l = lead as any
      if (!l.email) continue

      const notes = l.notes || ''
      const timelineMatch = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)
      if (!timelineMatch) continue

      let timeline: any[] = []
      try {
        timeline = JSON.parse(timelineMatch[1])
      } catch {
        continue
      }

      // Pegar e-mails enviados na semana passada (mais recente por lead)
      const weekEmails = timeline
        .filter(e => e.type === 'email' && e.ts && e.ts >= sevenDaysAgo && e.ts <= now)
        .sort((a: any, b: any) => b.ts - a.ts)

      if (weekEmails.length === 0) continue

      // Pegar o e-mail mais recente do lead na semana
      const latest = weekEmails[0]
      const originalSubject = (latest.label || '').replace('E-mail enviado: ', '') || '(sem assunto)'
      const originalBody = latest.body || latest.content || latest.text || ''

      toResend.push({
        leadId: l.id,
        leadName: l.name || '',
        leadEmail: l.email,
        leadCompany: l.company || '',
        leadRole: l.role || '',
        originalSubject,
        originalBody,
        originalTs: latest.ts,
      })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        total: toResend.length,
        leads: toResend.map(r => ({
          name: r.leadName,
          email: r.leadEmail,
          company: r.leadCompany,
          subject: `Acompanhamento: ${r.originalSubject}`,
          sentAt: new Date(r.originalTs).toLocaleDateString('pt-BR'),
        })),
      })
    }

    const results: { email: string; name: string; company: string; status: string; error?: string }[] = []
    let successCount = 0
    let errorCount = 0

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://itskilltech-crm.vercel.app'

    for (const item of toResend) {
      try {
        const newSubject = `Acompanhamento: ${item.originalSubject}`

        // Montar corpo do e-mail — se tiver corpo original usa, senão usa mensagem padrão de follow-up
        const bodyText = item.originalBody
          ? item.originalBody
          : `Olá ${item.leadName || 'tudo bem'},\n\nPassando para verificar se você teve a oportunidade de ver nosso e-mail anterior sobre o ${sender.name}.\n\nEstamos à disposição para tirar dúvidas e apresentar como podemos ajudar ${item.leadCompany || 'sua empresa'} a otimizar a gestão de transporte.\n\nAguardo seu retorno!\n\nAtenciosamente,\n${sender.displayName}`

        const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; line-height: 1.6; }
    .wrapper { max-width: 640px; margin: 32px auto; padding: 0 16px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, ${sender.color} 0%, ${sender.colorLight} 100%); padding: 28px 32px; }
    .header-company { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .header-badge { display: inline-block; background: rgba(255,255,255,0.2); color: #fff; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; margin-top: 8px; letter-spacing: 0.5px; text-transform: uppercase; }
    .content { padding: 32px; }
    .content p { margin-bottom: 16px; font-size: 15px; color: #374151; }
    .signature { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .sig-name { font-weight: 600; font-size: 15px; color: #111827; }
    .sig-title { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .sig-contact { margin-top: 8px; font-size: 13px; color: #374151; }
    .sig-contact a { color: ${sender.color}; text-decoration: none; }
    .footer { background: #fafafa; padding: 16px 32px; border-top: 1px solid #f3f4f6; }
    .footer p { font-size: 11px; color: #d1d5db; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-company">${sender.name}</div>
        <div class="header-badge">Acompanhamento</div>
      </div>
      <div class="content">
        ${bodyText.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')}
        <div class="signature">
          <div class="sig-name">${sender.displayName}</div>
          <div class="sig-title">${sender.name}</div>
          <div class="sig-contact">
            <a href="mailto:${sender.contactEmail}">${sender.contactEmail}</a><br>
            <a href="tel:${sender.phone.replace(/\D/g, '')}">${sender.phone}</a><br>
            <a href="https://www.gettms.com.br" style="color:${sender.color};">www.gettms.com.br</a> &nbsp;|&nbsp;
            <a href="https://www.lottustech.com.br" style="color:${sender.color};">www.lottustech.com.br</a>
          </div>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${sender.name}. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`

        // Pixel de rastreamento
        const trackPixel = `<img src="${baseUrl}/api/track-email?lid=${item.leadId}&ws=${workspace}" width="1" height="1" style="display:none;" alt="" />`
        const htmlWithPixel = htmlBody.replace('</body>', `${trackPixel}</body>`)

        const fromEmail = `${sender.displayName} | ${sender.name} <${sender.email}>`

        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: item.leadName ? `${item.leadName} <${item.leadEmail}>` : item.leadEmail,
          subject: newSubject,
          text: bodyText,
          html: htmlWithPixel,
        })

        if (error) {
          results.push({ email: item.leadEmail, name: item.leadName, company: item.leadCompany, status: 'error', error: error.message })
          errorCount++
        } else {
          results.push({ email: item.leadEmail, name: item.leadName, company: item.leadCompany, status: 'sent' })
          successCount++
        }

        // Pequena pausa para não sobrecarregar a API do Resend
        await new Promise(r => setTimeout(r, 200))

      } catch (err: any) {
        results.push({ email: item.leadEmail, name: item.leadName, company: item.leadCompany, status: 'error', error: err.message })
        errorCount++
      }
    }

    return NextResponse.json({
      ok: true,
      total: toResend.length,
      sent: successCount,
      errors: errorCount,
      results,
      message: `Reenvio concluído: ${successCount} e-mails enviados com sucesso, ${errorCount} erros.`,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET /api/resend-weekly — preview dos e-mails que seriam reenviados
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspace = searchParams.get('workspace') || 'lottus'

  const fakeReq = new Request(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace, dry_run: true }),
  })

  return POST(fakeReq as NextRequest)
}
