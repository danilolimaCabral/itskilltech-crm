const { sql } = require('@vercel/postgres');

// Injetar variáveis do ambiente da Vercel
const POSTGRES_URL = process.env.POSTGRES_URL || "postgres://default:S3m9FwIep8XN@ep-autumn-fire-a477w789-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require";

async function run() {
  console.log("Iniciando auditoria de logs de prospecção...");
  try {
    // 1. Verificar total de leads e quantos têm timeline
    const { rows: leads } = await sql`SELECT id, name, notes, status, updated_at FROM leads WHERE workspace = 'lottus'`;
    console.log(`Total de leads no workspace 'lottus': ${leads.length}`);

    let comTimeline = 0;
    let semTimeline = 0;
    let corrompidos = 0;
    let totalEventos = 0;
    const eventosPorTipo = {};

    leads.forEach(l => {
      const notes = l.notes || '';
      if (notes.includes('[TIMELINE]')) {
        comTimeline++;
        const match = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
        if (match) {
          try {
            const evs = JSON.parse(match[1]);
            totalEventos += evs.length;
            evs.forEach(e => {
              eventosPorTipo[e.type] = (eventosPorTipo[e.type] || 0) + 1;
            });
          } catch (e) {
            corrompidos++;
          }
        }
      } else if (notes.trim().startsWith('[') && notes.trim().endsWith(']')) {
        corrompidos++;
      } else {
        semTimeline++;
      }
    });

    console.log(`Leads com [TIMELINE] íntegra: ${comTimeline}`);
    console.log(`Leads sem timeline (nunca prospectados ou limpos): ${semTimeline}`);
    console.log(`Leads corrompidos (formato JSON puro ou erro de parse): ${corrompidos}`);
    console.log(`Total geral de eventos de prospecção encontrados: ${totalEventos}`);
    console.log("Eventos por tipo:", eventosPorTipo);

    // 2. Verificar a tabela call_logs (ligações duráveis)
    const { rows: callLogs } = await sql`SELECT COUNT(*) as count FROM call_logs WHERE workspace = 'lottus'`;
    console.log(`Total de registros na tabela call_logs: ${callLogs[0].count}`);

    // 3. Listar os últimos 5 eventos de prospecção para ver o que ocorreu ontem e quinta
    console.log("\nÚltimos leads atualizados e suas notas:");
    const { rows: recentes } = await sql`SELECT name, notes, status, updated_at FROM leads WHERE workspace = 'lottus' AND notes != '' ORDER BY updated_at DESC LIMIT 5`;
    recentes.forEach(r => {
      const data = new Date(Number(r.updated_at) || Date.now()).toLocaleString('pt-BR');
      console.log(`- Lead: ${r.name} | Status: ${r.status} | Atualizado: ${data}`);
      console.log(`  Notes: ${r.notes.slice(0, 200)}...`);
    });

  } catch (err) {
    console.error("Erro na auditoria:", err);
  }
}

run();
