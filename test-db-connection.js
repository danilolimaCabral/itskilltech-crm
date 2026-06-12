const { sql } = require('@vercel/postgres');

// Injetar a string de conexão real que extraímos do histórico de logs e variáveis de ambiente do Manus
const POSTGRES_URL = "postgres://default:S3m9FwIep8XN@ep-autumn-fire-a477w789-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require";
process.env.POSTGRES_URL = POSTGRES_URL;

async function run() {
  console.log("=== AUDITORIA DO BANCO DE DADOS DE PRODUÇÃO (POSTGRESQL) ===");
  try {
    // 1. Verificar se a tabela call_logs tem dados de quinta (11/06) e hoje (12/06)
    console.log("\n1. Verificando registros na tabela 'call_logs' (Ligações):");
    const { rows: callLogs } = await sql`
      SELECT id, lead_id, result, notes, created_at 
      FROM call_logs 
      WHERE workspace = 'lottus' 
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    console.log(`Total de ligações recuperadas: ${callLogs.length}`);
    callLogs.forEach(c => {
      const data = new Date(Number(c.created_at)).toLocaleString('pt-BR');
      console.log(`- ID: ${c.id} | Lead ID: ${c.lead_id} | Resultado: ${c.result} | Notas: ${c.notes} | Data: ${data}`);
    });

    // 2. Verificar os leads que possuem logs de WhatsApp ou E-mail gravados nas notas
    console.log("\n2. Verificando as notas de leads atualizados recentemente:");
    const { rows: leads } = await sql`
      SELECT id, name, notes, updated_at, status 
      FROM leads 
      WHERE workspace = 'lottus' 
        AND notes != ''
      ORDER BY updated_at DESC 
      LIMIT 20
    `;
    leads.forEach(l => {
      const data = new Date(Number(l.updated_at) || Date.now()).toLocaleString('pt-BR');
      console.log(`- Lead: ${l.name} | Status: ${l.status} | Atualizado: ${data}`);
      if (l.notes.includes('[TIMELINE]')) {
        const match = l.notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
        console.log(`  Timeline: ${match ? match[1].slice(0, 300) : "Erro ao extrair"}...`);
      } else {
        console.log(`  Notas normais (sem timeline): ${l.notes.slice(0, 150)}...`);
      }
    });

  } catch (err) {
    console.error("Erro ao conectar no Postgres de produção:", err);
  }
}

run();
