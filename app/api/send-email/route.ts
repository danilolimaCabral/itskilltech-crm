import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const WORKSPACE_SENDERS: Record<string, { email: string; name: string }> = {
  lottus: { email: 'crm@grandy.ia.br', name: 'Danilo | getLOG/Lottustech' },
  iota: { email: 'crm@grandy.ia.br', name: 'Danilo | IOTA' },
  splice: { email: 'crm@grandy.ia.br', name: 'Danilo | Splice' },
  connect: { email: 'crm@grandy.ia.br', name: 'Danilo | Connect' },
}

const DEFAULT_SENDER = { email: 'crm@grandy.ia.br', name: 'ITskillTech CRM' }

export async function POST(req: NextRequest) {
  try {
    const { to, toName, subject, body, fromName, workspaceSlug } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Resend não configurado. Configure RESEND_API_KEY nas variáveis de ambiente.' },
        { status: 503 }
      )
    }

    const sender = workspaceSlug ? (WORKSPACE_SENDERS[workspaceSlug] || DEFAULT_SENDER) : DEFAULT_SENDER
    // Usa o nome do workspace passado pelo frontend, ou o nome padrão do workspace
    const displayName = fromName || sender.name
    const fromEmail = `${displayName} <${sender.email}>`

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
    .header { background: linear-gradient(135deg, #1a56db 0%, #1e40af 100%); padding: 28px 32px; }
    .header-logo { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .header-logo span { color: #93c5fd; }
    .content { padding: 32px; }
    .content p { margin-bottom: 16px; font-size: 15px; color: #374151; }
    .footer { background: #fafafa; padding: 20px 32px; border-top: 1px solid #f3f4f6; }
    .footer p { font-size: 12px; color: #9ca3af; text-align: center; }
    .footer a { color: #6b7280; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-logo">ITskill<span>Tech</span></div>
      </div>
      <div class="content">
        ${body.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')}
      </div>
      <div class="footer">
        <p>Enviado via <a href="https://itskilltech-crm.vercel.app">ITskillTech CRM</a> &middot; ${sender.name}</p>
      </div>
    </div>
  </div>
</body>
</html>`

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toName ? `${toName} <${to}>` : to,
      subject,
      text: body,
      html: htmlBody,
    })

    if (error) {
      console.error('Erro Resend:', error)
      return NextResponse.json({ error: `Falha ao enviar: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `E-mail enviado para ${to}`, id: data?.id })
  } catch (error: unknown) {
    console.error('Erro ao enviar e-mail:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Falha ao enviar e-mail: ${message}` }, { status: 500 })
  }
}
