import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getLeads, upsertLead } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface SenderConfig {
  name: string
  displayName: string
  email: string
  contactEmail: string
  phone: string
}

// Configuração do remetente atualizada para usar crm@itskilltech.com.br (domínio verificado no Resend).
// Mantemos o replyTo apontando para danilo@lottustech.com.br para que as respostas dos leads cheguem ao e-mail comercial correto.
const WORKSPACE_SENDERS: Record<string, SenderConfig> = {
  lottus: {
    name: 'getLOG/Lottustech',
    displayName: 'Danilo Cabral',
    email: 'crm@itskilltech.com.br', // E-mail verificado no Resend
    contactEmail: 'danilo@lottustech.com.br', // E-mail de destino das respostas
    phone: '(41) 99949-9815'
  }
}

const DEFAULT_SENDER: SenderConfig = {
  name: 'getLOG/Lottustech',
  displayName: 'Danilo Cabral',
  email: 'crm@itskilltech.com.br',
  contactEmail: 'danilo@lottustech.com.br',
  phone: '(41) 99949-9815'
}

function getAttachmentName(url: string): string {
  try {
    const decoded = decodeURIComponent(url)
    const parts = decoded.split('/')
    const filename = parts[parts.length - 1]
    return filename.split('?')[0] || 'Material de Apoio'
  } catch (e) {
    return 'Material de Apoio'
  }
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, workspaceSlug, leadId, attachment_url } = await req.json()

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
    
    // O remetente do e-mail (From) agora usa crm@itskilltech.com.br
    const fromEmail = `${sender.displayName} | ${sender.name} <${sender.email}>`

    // Suporte a múltiplos anexos separados por |||
    const attachmentUrls: string[] = attachment_url
      ? attachment_url.split('|||').filter(Boolean)
      : []

    // Gerar links de acesso discretos em texto para cada material anexado (estilo Outlook)
    const attachmentLinksHtml = attachmentUrls.length > 0
      ? `<div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #475569;">
          <strong>Arquivos anexados a este e-mail:</strong><br />
          ${attachmentUrls.map(url => `
            - <a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${getAttachmentName(url)}</a>
          `).join('<br />')}
        </div>`
      : ''

    // Texto plano para os anexos
    const attachmentText = attachmentUrls.length > 0
      ? '\n\nArquivos anexados:\n' + attachmentUrls.map(url => `- ${getAttachmentName(url)}: ${url}`).join('\n')
      : ''

    const bodyClean = body.replace('[INLINE_IMAGES]', '').trim()

    // Montagem de um HTML 100% limpo, sem templates visuais, cores, blocos ou tabelas.
    // Simula perfeitamente um e-mail pessoal e direto enviado pelo Outlook ou Gmail corporativo.
    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; background-color: #ffffff; margin: 0; padding: 12px; font-size: 15px;">
  
  ${bodyClean.split('\n').map((line: string) => {
    const trimmed = line.trim();
    return trimmed ? `<p style="margin: 0 0 12px 0;">${trimmed}</p>` : '<p style="margin: 0 0 12px 0;">&nbsp;</p>';
  }).join('')}
  
  ${attachmentLinksHtml}
  
  <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 14px; color: #334155;">
    Atenciosamente,<br /><br />
    <strong>${sender.displayName}</strong><br />
    Gerente Comercial | ${sender.name}<br />
    E-mail: <a href="mailto:${sender.contactEmail}" style="color: #2563eb; text-decoration: none;">${sender.contactEmail}</a><br />
    Telefone/WhatsApp: <a href="tel:${sender.phone.replace(/\D/g, '')}" style="color: #2563eb; text-decoration: none;">${sender.phone}</a><br />
    Website: <a href="https://www.gettms.com.br" target="_blank" style="color: #2563eb; text-decoration: none;">www.gettms.com.br</a> &nbsp;|&nbsp; <a href="https://www.lottustech.com.br" target="_blank" style="color: #2563eb; text-decoration: none;">www.lottustech.com.br</a>
  </div>

  ${leadId && workspaceSlug ? `<img src="https://itskilltech-crm.vercel.app/api/track-email?lid=${leadId}&ws=${workspaceSlug}" width="1" height="1" style="display:none;width:1px;height:1px;" />` : ''}
</body>
</html>`
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Configurar o envio via Resend. O reply_to é configurado com o e-mail real do Danilo
    // para que qualquer resposta do cliente seja direcionada ao endereço correto de negócios.
    const mailOptions: any = {
      from: fromEmail,
      to: to,
      subject: subject,
      html: htmlBody,
      text: `${bodyClean}${attachmentText}\n\nAtenciosamente,\n\n${sender.displayName}\nGerente Comercial | ${sender.name}\n${sender.contactEmail} | ${sender.phone}\nwww.gettms.com.br | www.lottustech.com.br`,
      reply_to: sender.contactEmail
    }

    const { data, error } = await resend.emails.send(mailOptions)

    if (error) {
      console.error('Erro no Resend:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Registrar o envio do e-mail na timeline do lead se leadId estiver presente
    if (leadId && workspaceSlug) {
      try {
        const leads = await getLeads(workspaceSlug)
        const lead = leads.find((l: any) => l.id === leadId)
        if (lead) {
          const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\](.*?)\[\/TIMELINE\]/)?.[1] || '[]')
          
          // Registrar na timeline
          timeline.unshift({
            type: 'email',
            label: `E-mail enviado: "${subject}"`,
            ts: Date.now(),
            resend_id: data?.id || null
          })

          // Avançar o status se aplicável
          const STATUS_ADVANCE: Record<string, string> = {
            prospeccao: 'email_enviado',
            novo: 'email_enviado',
            contatado: 'email_enviado'
          }
          const normalizeStatus = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          const currentStatus = normalizeStatus(lead.status)
          const nextStatus = STATUS_ADVANCE[currentStatus] || currentStatus

          if (nextStatus !== currentStatus) {
            timeline.unshift({
              type: 'status',
              label: `Etapa → ✉️ E-mail Enviado`,
              ts: Date.now()
            })
          }

          const notesClean = lead.notes?.replace(/\[TIMELINE\].*?\[\/TIMELINE\]/g, '').trim() || ''
          const updatedLead = {
            ...lead,
            status: nextStatus,
            updated_at: Date.now(),
            notes: notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`
          }

          await upsertLead(updatedLead)
        }
      } catch (dbErr) {
        console.error('Erro ao salvar timeline do e-mail:', dbErr)
      }
    }

    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error: any) {
    console.error('Erro geral no envio de e-mail:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
