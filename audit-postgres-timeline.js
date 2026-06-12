const { Client } = require('pg');

const connectionString = process.env.POSTGRES_URL || 'postgres://default:S6KqBHe5iYmd@ep-autumn-paper-a4v9k9h9.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const { rows: leads } = await client.query("SELECT id, name, company, notes FROM leads WHERE workspace = 'lottus'");
  
  let totalEmails = 0;
  let totalWhats = 0;
  let totalCalls = 0;
  
  const targetDays = ['10/06', '11/06', '12/06'];
  const eventsFound = [];

  for (const lead of leads) {
    const notes = lead.notes || '';
    const match = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
    if (!match) continue;
    
    let timeline = [];
    try { timeline = JSON.parse(match[1]); } catch { continue; }
    
    for (const ev of timeline) {
      const dateStr = new Date(ev.ts).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).substring(0, 5);
      if (targetDays.includes(dateStr)) {
        if (ev.type === 'email') totalEmails++;
        if (ev.type === 'whatsapp') totalWhats++;
        if (ev.type === 'call') totalCalls++;
        
        eventsFound.push({
          lead: lead.name,
          company: lead.company,
          type: ev.type,
          date: dateStr,
          label: ev.label,
          ts: ev.ts
        });
      }
    }
  }
  
  console.log('=== AUDITORIA DE TIMELINES (10/06 a 12/06) ===');
  console.log('Total E-mails:', totalEmails);
  console.log('Total WhatsApps:', totalWhats);
  console.log('Total Ligações:', totalCalls);
  console.log('\nÚltimos 15 eventos encontrados:');
  console.log(JSON.stringify(eventsFound.slice(-30), null, 2));
  
  await client.end();
}

run().catch(console.error);
