import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { to, toName, subject, body, fromName } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 })
    }

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { error: 'Gmail não configurado. Configure GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis de ambiente.' },
        { status: 503 }
      )
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a56db; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 20px; }
          .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ITskillTech</h1>
          </div>
          <div class="content">
            ${body.replace(/\n/g, '<br>')}
          </div>
          <div class="footer">
            <p>Enviado via ITskillTech CRM · <a href="https://itskilltech-crm.vercel.app">itskilltech-crm.vercel.app</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: `"${fromName || 'ITskillTech CRM'}" <${gmailUser}>`,
      to: toName ? `"${toName}" <${to}>` : to,
      subject,
      text: body,
      html: htmlBody,
    }

    await transporter.sendMail(mailOptions)

    return NextResponse.json({ success: true, message: `E-mail enviado para ${to}` })
  } catch (error: unknown) {
    console.error('Erro ao enviar e-mail:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Falha ao enviar e-mail: ${message}` }, { status: 500 })
  }
}
