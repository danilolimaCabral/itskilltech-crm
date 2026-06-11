import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

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
  iota: {
    email: 'crm@grandy.ia.br',
    name: 'IOTA',
    displayName: 'Danilo Cabral',
    contactEmail: 'danilo@iota.com.br',
    phone: '(41) 99949-9815',
    color: '#1a56db',
    colorLight: '#1e40af',
  },
  splice: {
    email: 'crm@grandy.ia.br',
    name: 'Splice',
    displayName: 'Danilo Cabral',
    contactEmail: 'danilo@lottustech.com.br',
    phone: '(41) 99949-9815',
    color: '#ea580c',
    colorLight: '#c2410c',
  },
  connect: {
    email: 'crm@grandy.ia.br',
    name: 'Connectfy',
    displayName: 'Danilo Cabral',
    contactEmail: 'danilo@lottustech.com.br',
    phone: '(41) 99949-9815',
    color: '#7c3aed',
    colorLight: '#6d28d9',
  },
}

const DEFAULT_SENDER: WorkspaceSender = {
  email: 'crm@grandy.ia.br',
  name: 'getLOG/Lottustech',
  displayName: 'Danilo Cabral',
  contactEmail: 'danilo@lottustech.com.br',
  phone: '(41) 99949-9815',
  color: '#16a34a',
  colorLight: '#15803d',
}

export async function POST(req: NextRequest) {
  try {
    const { to, toName, subject, body, workspaceSlug, leadId, attachment_url } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Serviço de e-mail não configurado.' },
        { status: 503 }
      )
    }

    const sender = workspaceSlug ? (WORKSPACE_SENDERS[workspaceSlug] || DEFAULT_SENDER) : DEFAULT_SENDER
    const fromEmail = `${sender.displayName} | ${sender.name} <${sender.email}>`

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
      </div>
      <div class="content">
        ${body.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')}
        ${attachment_url ? `<div style="margin-top:20px;padding:16px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;"><div style="font-size:13px;font-weight:600;color:#0369a1;margin-bottom:10px;">&#128206; Apresenta&#231;&#227;o / Material</div><a href="${attachment_url}" style="display:inline-block;padding:10px 20px;background:${sender.color};color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">&#128196; Abrir apresenta&#231;&#227;o</a></div>` : ''}
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

    // Pixel de rastreamento de abertura
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://itskilltech-crm.vercel.app'
    const trackPixel = leadId
      ? `<img src="${baseUrl}/api/track-email?lid=${leadId}&ws=${workspaceSlug || 'lottus'}" width="1" height="1" style="display:none;" alt="" />`
      : ''
    const htmlWithPixel = htmlBody.replace('</body>', `${trackPixel}</body>`)

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toName ? `${toName} <${to}>` : to,
      bcc: ['danilo.rcabral@gmail.com'],
      subject,
      text: body + (attachment_url ? `\n\nApresentação: ${attachment_url}` : ''),
      html: htmlWithPixel,
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
