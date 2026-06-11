import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { GETLOG_IMAGES_B64 } from './getlog-images'

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

// Nomes amigáveis para os materiais Getlog
const ATTACHMENT_NAMES: Record<string, string> = {
  'jnlLhlJeYfwiGYhP.pdf': 'Apresentação Comercial Getlog',
  'GhIQFKQPUmFSyjsR.png': 'Post: Inteligência que Move sua Logística',
  'FmjALsVbrVJvwOsK.png': 'Post: Auditoria de Fretes Inteligente',
  'OtyLGYHZqqUEpeJn.png': 'Post: Controle Total da Operação Logística',
  'GddaxubzZmTXNJZZ.png': 'Post: Mais que um TMS — Plataforma Completa',
  'etOQbwNpmSHPnqTW.png': 'Post: Resultados que sua Logística pode Alcançar',
  'IQhCtpbryNiKvpbi.png': 'Post: Ferramentas de Auditoria para Embarcadores',
}

function getAttachmentName(url: string): string {
  const filename = url.split('/').pop() || ''
  return ATTACHMENT_NAMES[filename] || filename
}

function getAttachmentIcon(url: string): string {
  if (url.endsWith('.pdf')) return '📄'
  if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) return '🖼'
  return '📎'
}

// Gera o bloco HTML de imagens inline do Getlog usando base64 (sem dependência de URL externa)
function buildInlineImagesHtml(senderColor: string): string {
  const imgs = GETLOG_IMAGES_B64
  const rows = []
  for (let i = 0; i < imgs.length; i += 2) {
    const pair = imgs.slice(i, i + 2)
    rows.push(`
    <tr>
      ${pair.map(b64 => `
      <td width="50%" style="padding:4px;">
        <a href="https://www.gettms.com.br" target="_blank" style="display:block;">
          <img src="${b64}" alt="Getlog" width="100%" style="display:block;border-radius:8px;max-width:280px;" />
        </a>
      </td>`).join('')}
    </tr>`)
  }
  return `
<div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:24px;">
  <div style="font-size:13px;font-weight:700;color:${senderColor};margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;">📸 Conheça o Getlog</div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    ${rows.join('')}
  </table>
  <div style="margin-top:14px;text-align:center;">
    <a href="https://www.gettms.com.br" target="_blank" style="display:inline-block;padding:11px 28px;background:${senderColor};color:#fff;border-radius:7px;text-decoration:none;font-size:14px;font-weight:700;">🌐 Acesse www.gettms.com.br</a>
  </div>
</div>`
}

export async function POST(req: NextRequest) {
  try {
    const { to, toName, subject, body, workspaceSlug, leadId, attachment_url, attachment_file, inline_images } = await req.json()

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

    // Suporte a múltiplos anexos separados por |||
    const attachmentUrls: string[] = attachment_url
      ? attachment_url.split('|||').filter(Boolean)
      : []

    // Gerar botões de acesso para cada material selecionado (PDFs e outros não-imagens)
    const nonImageAttachments = attachmentUrls.filter(u => !u.match(/\.(png|jpg|jpeg|gif|webp)$/i))
    const attachmentButtonsHtml = nonImageAttachments.length > 0
      ? `<div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
          <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:10px;">📎 Material em anexo</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${nonImageAttachments.map(url => `
              <a href="${url}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:white;border:1px solid #d1fae5;border-radius:7px;text-decoration:none;color:#15803d;font-size:13px;font-weight:600;">
                <span>${getAttachmentIcon(url)}</span>
                <span>${getAttachmentName(url)}</span>
              </a>
            `).join('')}
          </div>
        </div>`
      : ''

    // Texto plano para os anexos
    const attachmentText = attachmentUrls.length > 0
      ? '\n\nMateriais:\n' + attachmentUrls.map(url => `- ${getAttachmentName(url)}: ${url}`).join('\n')
      : ''

    // Imagens inline no corpo (quando inline_images=true ou body contém [INLINE_IMAGES])
    const useInlineImages = inline_images === true || body.includes('[INLINE_IMAGES]')
    const bodyClean = body.replace('[INLINE_IMAGES]', '').trim()
    const inlineImagesHtml = useInlineImages ? buildInlineImagesHtml(sender.color) : ''

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
        ${bodyClean.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')}
        ${attachmentButtonsHtml}
        ${inlineImagesHtml}
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

    // Suporte a arquivo base64 enviado diretamente
    const resendAttachments: Array<{ filename: string; content: string }> = []
    if (attachment_file?.base64 && attachment_file?.name) {
      resendAttachments.push({
        filename: attachment_file.name,
        content: attachment_file.base64,
      })
    }

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toName ? `${toName} <${to}>` : to,
      bcc: ['danilo.rcabral@gmail.com'],
      subject,
      text: bodyClean + attachmentText,
      html: htmlWithPixel,
      ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
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
