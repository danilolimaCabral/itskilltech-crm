import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaces, getLeads } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Cron de follow-up automático via WhatsApp.
 * Roda todo dia às 11h (BRT) — vercel.json: "0 14 * * 1-5"
 * Lógica: leads em status "email_aberto" há mais de 2 dias sem resposta → envia WhatsApp
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://itskilltech-crm.vercel.app';
  const ZAPI_ID = process.env.ZAPI_INSTANCE_ID;
  const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
  const zapiConfigured = !!(ZAPI_ID && ZAPI_TOKEN);

  const now = Date.now();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

  const results: any[] = [];

  try {
    const workspaces = await getWorkspaces();

    for (const ws of workspaces) {
      try {
        const leads = await getLeads(ws.id);

        // Filtrar leads que:
        // 1. Estão em status "email_aberto"
        // 2. Foram atualizados há mais de 2 dias (sem nova interação)
        // 3. Têm telefone/whatsapp cadastrado
        // 4. Ainda não receberam follow-up WhatsApp (verificar na timeline)
        const followupCandidates = leads.filter((lead: any) => {
          if (lead.status !== 'email_aberto') return false;
          const lastUpdate = lead.updated_at || lead.created_at || 0;
          if (now - lastUpdate < TWO_DAYS_MS) return false;
          const phone = lead.whatsapp || lead.phone;
          if (!phone || phone.replace(/\D/g, '').length < 8) return false;
          // Verificar se já enviou follow-up WhatsApp
          const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
          const alreadySentFollowup = timeline.some((e: any) => e.type === 'whatsapp' && e.label?.includes('follow-up'));
          return !alreadySentFollowup;
        });

        if (followupCandidates.length === 0) continue;

        for (const lead of followupCandidates.slice(0, 10)) { // max 10 por workspace por dia
          try {
            const firstName = lead.name?.split(' ')[0] || lead.name;
            const company = lead.company || 'sua empresa';
            const wsName = ws.name || 'getLOG/Lottustech';

            const message = `Olá ${firstName}! 👋\n\nVi que você abriu nosso e-mail sobre a solução TMS da ${wsName} para ${company}.\n\nFiquei curioso — teve alguma dúvida ou gostaria de ver uma demonstração rápida de 15 minutos? 🚀\n\nwww.gettms.com.br`;

            let sent = false;

            if (zapiConfigured) {
              // Enviar via Z-API
              const phone = (lead.whatsapp || lead.phone || '').replace(/\D/g, '');
              const zapiBase = `https://api.z-api.io/instances/${ZAPI_ID}/token/${ZAPI_TOKEN}`;
              const clientToken = process.env.ZAPI_CLIENT_TOKEN || '';
              const headers: any = { 'Content-Type': 'application/json' };
              if (clientToken) headers['Client-Token'] = clientToken;

              const res = await fetch(`${zapiBase}/send-text`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ phone: phone.startsWith('55') ? phone : `55${phone}`, message }),
              });
              const data = await res.json();
              sent = res.ok && (data.zaapId || data.id);
            }

            // Registrar na timeline do lead
            const timeline = JSON.parse(lead.notes?.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)?.[1] || '[]');
            timeline.unshift({
              type: 'whatsapp',
              label: `WhatsApp follow-up ${sent ? 'enviado via Z-API' : 'agendado (Z-API não configurada)'}`,
              ts: Date.now(),
            });
            const notesClean = (lead.notes || '').replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();
            const updatedNotes = notesClean + `\n[TIMELINE]${JSON.stringify(timeline)}[/TIMELINE]`;

            // Atualizar lead via API
            await fetch(`${baseUrl}/api/leads`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: lead.id, notes: updatedNotes, updated_at: Date.now() }),
            });

            results.push({
              workspace: ws.id,
              lead: lead.name,
              phone: lead.whatsapp || lead.phone,
              sent,
              method: zapiConfigured ? 'zapi' : 'none',
            });

            // Delay anti-spam entre envios
            await new Promise(r => setTimeout(r, 2000));
          } catch (e: any) {
            results.push({ workspace: ws.id, lead: lead.name, error: e.message });
          }
        }
      } catch (e: any) {
        results.push({ workspace: ws.id, error: e.message });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Follow-up WhatsApp processado: ${results.filter(r => r.sent).length} enviados, ${results.filter(r => !r.sent && !r.error).length} registrados (sem Z-API), ${results.filter(r => r.error).length} erros`,
      results,
      zapiConfigured,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
