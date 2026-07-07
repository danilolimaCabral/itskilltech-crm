import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaces, getAgentConfig, initAgentTables } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

/**
 * Rota de Cron Job — executada automaticamente pela Vercel todo dia útil às 9h (BRT).
 * Também pode ser chamada manualmente via GET /api/cron/prospect
 *
 * A Vercel envia o header "Authorization: Bearer <CRON_SECRET>" para autenticar.
 */
export async function GET(req: NextRequest) {
  // Verificar autenticação (Vercel envia CRON_SECRET automaticamente)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://itskilltech-crm.vercel.app';
  const results: any[] = [];
  const errors: any[] = [];

  try {
    await initAgentTables();

    // Buscar todos os workspaces com agente ativo
    const workspaces = await getWorkspaces();
    const activeWorkspaces: any[] = [];

    for (const ws of workspaces) {
      const config = await getAgentConfig(ws.id);
      if (config?.enabled) {
        activeWorkspaces.push({ ws, config });
      }
    }

    if (activeWorkspaces.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Nenhum workspace com agente ativo. Ative o agente no painel "🤖 Agente IA" do CRM.',
        ran: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Executar prospecção para cada workspace ativo
    for (const { ws, config } of activeWorkspaces) {
      try {
        const res = await fetch(`${baseUrl}/api/auto-prospect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace: ws.id,
            wsName: ws.name,
            industry: config.industry || 'logistica',
            limit: config.daily_limit || 10,
            send_email: config.send_email ?? true,
            source: config.source || 'cnpja,apollo',
            email_template: config.email_template || '',
            email_subject: config.email_subject || '',
            force: true,
          }),
        });

        const data = await res.json();
        results.push({
          workspace: ws.id,
          name: ws.name,
          ok: data.ok,
          leads_found: data.leads_found || 0,
          leads_imported: data.leads_imported || 0,
          emails_sent: data.emails_sent || 0,
          errors: data.errors || 0,
        });
      } catch (e: any) {
        errors.push({ workspace: ws.id, error: e.message });
      }
    }

    const totalImported = results.reduce((s, r) => s + (r.leads_imported || 0), 0);
    const totalEmails = results.reduce((s, r) => s + (r.emails_sent || 0), 0);

    return NextResponse.json({
      ok: true,
      message: `Cron executado com sucesso — ${totalImported} leads importados, ${totalEmails} e-mails enviados`,
      ran: results.length,
      results,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
