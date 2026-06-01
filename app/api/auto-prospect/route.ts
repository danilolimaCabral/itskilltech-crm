import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  hasDatabase, initAgentTables, getAgentConfig, upsertAgentConfig,
  insertAgentRun, updateAgentRun, getAgentRuns, getLeadEmails, upsertLead,
} from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const openai = new OpenAI();
const CNPJA_KEY = process.env.CNPJA_API_KEY || '';
const APOLLO_KEY = process.env.APOLLO_API_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';

const uid = () => 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

// ── Mapeamento CNAE por segmento ──────────────────────────────────────────────
const CNAE_MAP: Record<string, string[]> = {
  logistica:   ['5211', '5212', '5229', '5231', '5232', '5239', '5240'],
  transporte:  ['4930', '4921', '4922', '4923', '4924', '4929'],
  tms:         ['4930', '5211', '5212', '5229'],
  tecnologia:  ['6201', '6202', '6203', '6204', '6209', '6311'],
  software:    ['6201', '6202', '6203', '6204', '6209'],
  atacado:     ['4639', '4641', '4642', '4643', '4644', '4649'],
  industria:   ['2511', '2512', '2521', '2522', '2531', '2532'],
  saude:       ['8610', '8621', '8622', '8630', '8640', '8650'],
  varejo:      ['4711', '4712', '4713', '4721', '4722', '4723'],
  construcao:  ['4110', '4120', '4211', '4212', '4213', '4221'],
  agro:        ['0111', '0112', '0113', '0114', '0115', '0116'],
  financeiro:  ['6411', '6412', '6421', '6422', '6423', '6424'],
  educacao:    ['8511', '8512', '8513', '8520', '8531', '8532'],
  alimentos:   ['1011', '1012', '1013', '1020', '1031', '1032'],
};

// ── Senders por workspace ─────────────────────────────────────────────────────
const SENDERS: Record<string, any> = {
  lottus: { email: 'crm@grandy.ia.br', name: 'getLOG/Lottustech', displayName: 'Danilo Cabral', contactEmail: 'danilo@lottustech.com.br', phone: '(41) 99949-9815', color: '#0066ff', colorLight: '#0052cc' },
  iota:   { email: 'crm@grandy.ia.br', name: 'IOTA', displayName: 'Danilo Cabral', contactEmail: 'danilo@iota.com.br', phone: '(41) 99949-9815', color: '#6938ef', colorLight: '#5b21b6' },
  splice: { email: 'crm@grandy.ia.br', name: 'Splice', displayName: 'Danilo Cabral', contactEmail: 'danilo@splice.com.br', phone: '(41) 99949-9815', color: '#079455', colorLight: '#15803d' },
};
const DEFAULT_SENDER = SENDERS.lottus;

// ── Fonte 1: CNPJ.já ──────────────────────────────────────────────────────────
async function fetchFromCnpja(industry: string, limit: number, state?: string): Promise<any[]> {
  if (!CNPJA_KEY) return [];
  try {
    const segLower = industry.toLowerCase().trim();
    let cnaeCodes: string[] = [];
    for (const [key, codes] of Object.entries(CNAE_MAP)) {
      if (segLower.includes(key) || key.includes(segLower)) { cnaeCodes = codes; break; }
    }
    if (!cnaeCodes.length) {
      // Tentar IA para mapear CNAE
      try {
        const resp = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: 'Retorne SOMENTE um array JSON com códigos CNAE de 4 dígitos (máx 4). Sem texto adicional.' },
            { role: 'user', content: `Códigos CNAE para o segmento "${industry}"? Ex: ["4930","5211"]` },
          ],
          temperature: 0.1, max_tokens: 100,
        });
        const raw = (resp.choices[0]?.message?.content || '[]').replace(/```[a-z]*\s*/g, '').trim();
        const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]');
        if (Array.isArray(parsed) && parsed.length) cnaeCodes = parsed.slice(0, 4).map(String);
      } catch {}
    }
    if (!cnaeCodes.length) return [];

    const params = new URLSearchParams({ limit: String(Math.min(limit, 20)) });
    if (state) params.set('state', state);
    params.set('mainActivity', cnaeCodes[0]);

    const res = await fetch(`https://api.cnpja.com/search?${params}`, {
      headers: { Authorization: CNPJA_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const offices = data.offices || data.results || [];
    return offices.map((o: any) => {
      const company = o.company || {};
      const phones = o.phones || [];
      const emails = o.emails || [];
      const phone = phones[0] ? `(${phones[0].area}) ${phones[0].number.slice(0, -4)}-${phones[0].number.slice(-4)}` : '';
      const email = emails[0]?.address || (o.address?.city ? `contato@${(company.name || '').toLowerCase().replace(/\s+/g, '').slice(0, 20)}.com.br` : '');
      return {
        id: uid(),
        name: company.name || o.alias || '',
        company: company.name || o.alias || '',
        role: 'Empresa',
        email,
        phone,
        whatsapp: '',
        linkedin: '',
        source: 'CNPJ.já',
        cnpj: o.taxId || '',
        city: o.address?.city || '',
        state: o.address?.state || '',
        cnae: o.mainActivity?.text || '',
        size: company.size?.text || '',
      };
    }).filter((l: any) => l.name && l.email);
  } catch { return []; }
}

// ── Fonte 2: Apollo.io ────────────────────────────────────────────────────────
async function fetchFromApollo(industry: string, limit: number): Promise<any[]> {
  if (!APOLLO_KEY) return [];
  try {
    const INDUSTRY_MAP: Record<string, string> = {
      logistica: 'logistics and supply chain', transporte: 'transportation/trucking/railroad',
      tecnologia: 'information technology and services', software: 'computer software',
      saude: 'hospital & health care', varejo: 'retail', atacado: 'wholesale',
      industria: 'industrial automation', construcao: 'construction',
      agro: 'farming', financeiro: 'financial services', educacao: 'e-learning',
    };
    const apolloIndustry = INDUSTRY_MAP[industry.toLowerCase()] || industry;
    const payload = {
      page: 1, per_page: Math.min(limit, 25),
      organization_locations: ['Brazil'],
      q_organization_keyword_tags: [apolloIndustry],
    };
    const res = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const orgs = data.organizations || data.accounts || [];
    return orgs.map((org: any) => ({
      id: uid(),
      name: org.name || '',
      company: org.name || '',
      role: 'Empresa',
      email: org.primary_domain ? `contato@${org.primary_domain}` : '',
      phone: org.phone || '',
      whatsapp: '',
      linkedin: org.linkedin_url || '',
      source: 'Apollo.io',
      city: org.city || '',
      state: '',
      cnae: org.industry || industry,
      size: org.num_employees_range || '',
    })).filter((l: any) => l.name && l.email);
  } catch { return []; }
}

// ── Geração de e-mail personalizado por IA ────────────────────────────────────
async function generateEmail(lead: any, workspace: string, wsName: string, customTemplate?: string, customSubject?: string) {
  const firstName = (lead.name || '').split(' ')[0] || 'Prezado';
  const company = lead.company || lead.name || 'sua empresa';

  if (customTemplate && customSubject) {
    const body = customTemplate
      .replace(/\{\{nome\}\}/g, firstName)
      .replace(/\{\{empresa\}\}/g, company)
      .replace(/\{\{cargo\}\}/g, lead.role || 'decisor')
      .replace(/\{\{segmento\}\}/g, lead.cnae || 'logística');
    const subject = customSubject
      .replace(/\{\{empresa\}\}/g, company)
      .replace(/\{\{nome\}\}/g, firstName);
    return { subject, body };
  }

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Você é especialista em cold email B2B para vendas de TMS (sistema de gestão de transporte logístico). Crie e-mails curtos, diretos e personalizados em português brasileiro para a empresa ${wsName}. O remetente é Danilo Cabral.`,
        },
        {
          role: 'user',
          content: `Crie um cold email de prospecção para:
- Empresa: ${company}
- Segmento: ${lead.cnae || 'logística e transporte'}
- Cidade: ${lead.city || 'Brasil'}
- Porte: ${lead.size || 'médio porte'}

Retorne SOMENTE JSON: {"subject": "...", "body": "..."}
- Assunto: criativo, personalizado, sem spam words
- Corpo: 3-4 parágrafos curtos, mencione a empresa, use {{nome}} para o primeiro nome
- Inclua CTA claro (15 minutos de conversa)
- Tom profissional mas humano`,
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(resp.choices[0]?.message?.content || '{}');
    const body = (parsed.body || '').replace(/\{\{nome\}\}/g, firstName);
    return { subject: parsed.subject || `Solução TMS para ${company}`, body };
  } catch {
    return {
      subject: `Apresentação ${wsName} — Solução TMS para ${company}`,
      body: `Olá ${firstName},\n\nTudo bem?\n\nMeu nome é Danilo, da ${wsName}. Vi que a ${company} atua no segmento de ${lead.cnae || 'logística'} e acredito que nossa solução de TMS pode otimizar significativamente a operação de vocês.\n\nGostaria de agendar uma conversa rápida de 15 minutos para apresentar os resultados que estamos gerando para empresas do mesmo segmento.\n\nQual seria o melhor horário para você?\n\nAtenciosamente,\nDanilo Cabral\n${wsName}`,
    };
  }
}

// ── Envio de e-mail via Resend ────────────────────────────────────────────────
async function sendEmail(to: string, toName: string, subject: string, body: string, workspace: string, leadId: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  try {
    const sender = SENDERS[workspace] || DEFAULT_SENDER;
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://itskilltech-crm.vercel.app';
    const trackPixel = `<img src="${baseUrl}/api/track-email?lid=${leadId}&ws=${workspace}" width="1" height="1" style="display:none;" alt="" />`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f5;color:#18181b;line-height:1.6}
      .w{max-width:640px;margin:32px auto;padding:0 16px}.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
      .hdr{background:linear-gradient(135deg,${sender.color} 0%,${sender.colorLight} 100%);padding:28px 32px}.hdr-co{font-size:22px;font-weight:700;color:#fff;letter-spacing:-.5px}
      .cnt{padding:32px}.cnt p{margin-bottom:16px;font-size:15px;color:#374151}
      .sig{margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb}.sig-n{font-weight:600;font-size:15px;color:#111827}
      .sig-t{font-size:13px;color:#6b7280;margin-top:2px}.sig-c{margin-top:8px;font-size:13px;color:#374151}.sig-c a{color:${sender.color};text-decoration:none}
      .ftr{background:#fafafa;padding:16px 32px;border-top:1px solid #f3f4f6}.ftr p{font-size:11px;color:#d1d5db;text-align:center}
    </style></head><body><div class="w"><div class="card">
      <div class="hdr"><div class="hdr-co">${sender.name}</div></div>
      <div class="cnt">
        ${body.split('\n').map((l: string) => l.trim() ? `<p>${l}</p>` : '<br>').join('')}
        <div class="sig">
          <div class="sig-n">${sender.displayName}</div>
          <div class="sig-t">${sender.name}</div>
          <div class="sig-c">
            <a href="mailto:${sender.contactEmail}">${sender.contactEmail}</a><br>
            <a href="tel:${sender.phone.replace(/\D/g,'')}">${sender.phone}</a><br>
            <a href="https://www.gettms.com.br">www.gettms.com.br</a>
          </div>
        </div>
      </div>
      <div class="ftr"><p>&copy; ${new Date().getFullYear()} ${sender.name}. Todos os direitos reservados.</p></div>
    </div></div>${trackPixel}</body></html>`;

    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_KEY);
    const { error } = await resend.emails.send({
      from: `${sender.displayName} | ${sender.name} <${sender.email}>`,
      to: toName ? `${toName} <${to}>` : to,
      subject, html, text: body,
    });
    return !error;
  } catch { return false; }
}

// ── GET: status do agente ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace') || 'lottus';
  await initAgentTables();
  const config = await getAgentConfig(workspace);
  const runs = await getAgentRuns(workspace, 10);
  return NextResponse.json({
    ok: true,
    config: config || { workspace, enabled: false, industry: 'logistica', source: 'cnpja,apollo', daily_limit: 10, send_email: true },
    runs,
    sources: {
      cnpja: !!CNPJA_KEY,
      apollo: !!APOLLO_KEY,
      resend: !!RESEND_KEY,
    },
  });
}

// ── PUT: salvar configuração ──────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const body = await req.json();
  await initAgentTables();
  await upsertAgentConfig(body);
  return NextResponse.json({ ok: true });
}

// ── POST: executar prospecção ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const workspace = body.workspace || 'lottus';
  const wsName = body.wsName || 'getLOG/Lottustech';

  await initAgentTables();
  const config = await getAgentConfig(workspace);
  if (!config && !body.force) {
    return NextResponse.json({ ok: false, error: 'Agente não configurado para este workspace' }, { status: 400 });
  }

  const industry = body.industry || config?.industry || 'logistica';
  const limit = body.limit || config?.daily_limit || 10;
  const doSendEmail = body.send_email ?? config?.send_email ?? true;
  const sources = (body.source || config?.source || 'cnpja,apollo').split(',').map((s: string) => s.trim());
  const customTemplate = config?.email_template || '';
  const customSubject = config?.email_subject || '';

  const runId = uid();
  const startedAt = Date.now();
  await insertAgentRun({ id: runId, workspace, started_at: startedAt, status: 'running' });

  const logs: string[] = [];
  let leadsFound = 0, leadsImported = 0, emailsSent = 0, errors = 0;

  try {
    // Buscar e-mails já existentes para evitar duplicatas
    const existingEmails = new Set(await getLeadEmails(workspace));
    logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] Iniciando prospecção — segmento: ${industry}, limite: ${limit}`);
    logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] E-mails já cadastrados: ${existingEmails.size}`);

    let allLeads: any[] = [];

    // Fonte 1: CNPJ.já
    if (sources.includes('cnpja') && CNPJA_KEY) {
      logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] Buscando no CNPJ.já...`);
      const cnpjaLeads = await fetchFromCnpja(industry, limit);
      logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] CNPJ.já: ${cnpjaLeads.length} empresas encontradas`);
      allLeads.push(...cnpjaLeads);
    }

    // Fonte 2: Apollo.io
    if (sources.includes('apollo') && APOLLO_KEY && allLeads.length < limit) {
      logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] Buscando no Apollo.io...`);
      const apolloLeads = await fetchFromApollo(industry, limit - allLeads.length);
      logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] Apollo.io: ${apolloLeads.length} empresas encontradas`);
      allLeads.push(...apolloLeads);
    }

    leadsFound = allLeads.length;
    logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] Total encontrado: ${leadsFound} leads`);

    // Filtrar duplicatas
    const newLeads = allLeads.filter(l => l.email && !existingEmails.has(l.email));
    logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] Novos (sem duplicata): ${newLeads.length}`);

    // Processar cada lead
    for (const lead of newLeads.slice(0, limit)) {
      try {
        const now = Date.now();
        const leadToSave = {
          id: lead.id,
          workspace,
          name: lead.name,
          company: lead.company,
          role: lead.role || 'Empresa',
          email: lead.email,
          phone: lead.phone || '',
          whatsapp: '',
          linkedin: lead.linkedin || '',
          source: lead.source || 'Agente',
          notes: lead.cnpj ? `CNPJ: ${lead.cnpj}\nCNAE: ${lead.cnae}\nCidade: ${lead.city}/${lead.state}\nPorte: ${lead.size}` : `Segmento: ${lead.cnae}\nCidade: ${lead.city}`,
          status: 'prospeccao',
          call_count: 0,
          last_contact: null,
          created_at: now,
          updated_at: now,
        };

        await upsertLead(leadToSave);
        leadsImported++;
        existingEmails.add(lead.email);
        logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ✓ Importado: ${lead.name} (${lead.email})`);

        // Enviar e-mail se habilitado
        if (doSendEmail && RESEND_KEY) {
          const { subject, body: emailBody } = await generateEmail(lead, workspace, wsName, customTemplate, customSubject);
          const sent = await sendEmail(lead.email, lead.name, subject, emailBody, workspace, lead.id);
          if (sent) {
            emailsSent++;
            logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ✉ E-mail enviado: ${lead.email} — "${subject}"`);
            // Atualizar status para qualificacao após envio
            await upsertLead({ ...leadToSave, status: 'qualificacao', updated_at: Date.now() });
          } else {
            logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ⚠ Falha ao enviar e-mail para ${lead.email}`);
          }
          // Delay entre envios para evitar rate limit
          await new Promise(r => setTimeout(r, 800));
        }
      } catch (e: any) {
        errors++;
        logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ✗ Erro em ${lead.name}: ${e.message}`);
      }
    }

    // Atualizar last_run na config
    if (config) {
      await upsertAgentConfig({ ...config, last_run: Date.now() });
    }

    logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ✅ Concluído — Importados: ${leadsImported}, E-mails: ${emailsSent}, Erros: ${errors}`);

    await updateAgentRun(runId, {
      finished_at: Date.now(), status: 'done',
      leads_found: leadsFound, leads_imported: leadsImported,
      emails_sent: emailsSent, errors,
      log: logs.join('\n'),
    });

    return NextResponse.json({
      ok: true, runId,
      leads_found: leadsFound, leads_imported: leadsImported,
      emails_sent: emailsSent, errors,
      log: logs,
    });
  } catch (e: any) {
    logs.push(`[${new Date().toLocaleTimeString('pt-BR')}] ✗ Erro fatal: ${e.message}`);
    await updateAgentRun(runId, {
      finished_at: Date.now(), status: 'error',
      leads_found: leadsFound, leads_imported: leadsImported,
      emails_sent: emailsSent, errors: errors + 1,
      log: logs.join('\n'),
    });
    return NextResponse.json({ ok: false, error: e.message, log: logs }, { status: 500 });
  }
}
