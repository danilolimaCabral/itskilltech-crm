import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Pixel de rastreamento 1x1 transparente
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lid');
  const workspace = searchParams.get('ws');

  if (leadId && workspace) {
    try {
      // Buscar o lead atual
      const { rows } = await sql`SELECT * FROM leads WHERE id = ${leadId} AND workspace = ${workspace} LIMIT 1`;
      if (rows.length > 0) {
        const lead = rows[0];
        const currentStatus = lead.status || 'prospeccao';

        // Só avança se ainda não foi marcado como aberto
        if (currentStatus === 'qualificacao' || currentStatus === 'prospeccao') {
          const now = new Date().toISOString();

          // Atualizar status para "email_aberto"
          let notes = lead.notes || '';
          let timeline: any[] = [];
          try { timeline = JSON.parse(notes); } catch { timeline = []; }
          if (!Array.isArray(timeline)) timeline = [];

          timeline.push({
            type: 'email_opened',
            label: '📬 E-mail aberto pelo destinatário',
            date: now,
            auto: true,
          });

          await sql`
            UPDATE leads
            SET status = 'email_aberto', notes = ${JSON.stringify(timeline)}, updated_at = ${now}
            WHERE id = ${leadId} AND workspace = ${workspace}
          `;

          // Disparar follow-up automático via Resend
          const resendKey = process.env.RESEND_API_KEY;
          if (resendKey && lead.email) {
            const workspaceSenders: Record<string, { name: string; email: string; color: string; phone: string; site: string }> = {
              lottus:    { name: 'getLOG/Lottustech', email: 'crm@itskilltech.com.br', color: '#16a34a', phone: '(41) 99949-9815', site: 'www.gettms.com.br' },
              iota:      { name: 'IOTA',              email: 'crm@itskilltech.com.br', color: '#1a56db', phone: '(41) 99949-9815', site: 'www.gettms.com.br' },
              splice:    { name: 'Splice',            email: 'crm@itskilltech.com.br', color: '#ea580c', phone: '(41) 99949-9815', site: 'www.gettms.com.br' },
              connectfy: { name: 'Connectfy',         email: 'crm@itskilltech.com.br', color: '#7c3aed', phone: '(41) 99949-9815', site: 'www.gettms.com.br' },
            };
            const sender = workspaceSenders[workspace] || workspaceSenders['lottus'];
            const leadName = lead.name?.split(' ')[0] || 'você';
            const company = lead.company || lead.name || 'sua empresa';

            const followUpHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:${sender.color};padding:28px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${sender.name}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${sender.site}</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Olá, <strong>${leadName}</strong>!</p>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
            Vi que você deu uma olhada no nosso e-mail sobre como podemos otimizar a gestão de transporte da <strong>${company}</strong>.
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
            Você tem interesse em conhecer melhor nossa solução de TMS? Posso agendar uma conversa rápida de <strong>15 minutos</strong> para mostrar como empresas do mesmo segmento estão reduzindo custos com nossa plataforma.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
            Qual seria o melhor horário para você?
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:${sender.color};border-radius:8px;padding:12px 28px;">
              <a href="https://${sender.site}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                Conhecer o ${sender.name} →
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e2e8f0;background:#f8fafc;">
          <p style="margin:0;font-size:13px;color:#64748b;">
            <strong>Danilo Cabral</strong> · ${sender.name}<br>
            📧 danilo@lottustech.com.br · 📱 ${sender.phone}<br>
            🌐 <a href="https://${sender.site}" style="color:${sender.color};">${sender.site}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `Danilo Cabral | ${sender.name} <${sender.email}>`,
                to: [lead.email],
                subject: `${leadName}, você tem interesse em otimizar a logística da ${company}?`,
                html: followUpHtml,
              }),
            });

            // Registrar follow-up na timeline
            timeline.push({
              type: 'email',
              label: `📧 Follow-up automático enviado: "Você tem interesse?"`,
              date: new Date().toISOString(),
              auto: true,
            });
            await sql`
              UPDATE leads
              SET notes = ${JSON.stringify(timeline)}, updated_at = ${new Date().toISOString()}
              WHERE id = ${leadId} AND workspace = ${workspace}
            `;
          }
        }
      }
    } catch (err) {
      // Silencioso — não pode quebrar o pixel
      console.error('Track email error:', err);
    }
  }

  // Sempre retorna o pixel transparente
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
