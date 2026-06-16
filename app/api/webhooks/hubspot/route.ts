import { NextResponse } from 'next/server';
import { getLeads, upsertLead, hasDatabase } from '@/lib/db';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

// Interface do payload esperado do HubSpot (adaptado para receber direto de Workflows, Forms ou Webhooks gerais do HubSpot)
interface HubSpotLeadPayload {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  mobilephone?: string;
  company?: string;
  jobtitle?: string;
  workspace?: string; // Opcional, se o HubSpot enviar qual workspace destinar (default: 'lottus')
  source?: string;    // Opcional, ex: "Inbound HubSpot"
  notes?: string;     // Opcional, anotações extras do lead
}

export async function POST(req: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ ok: false, error: 'Banco de dados não configurado' }, { status: 500 });
  }

  try {
    const payload = await req.json();
    console.log('Recebido webhook do HubSpot:', JSON.stringify(payload));

    // O HubSpot envia dados de diferentes formas dependendo se é Webhook de Workflow ou Form.
    // Vamos mapear de forma extremamente flexível e resiliente.
    
    // 1. Extração de propriedades do HubSpot (pode vir aninhado em "properties" ou direto no objeto raiz)
    const props = payload.properties || payload;
    
    const email = (props.email?.value || props.email || '').trim().toLowerCase();
    const rawPhone = (props.mobilephone?.value || props.mobilephone || props.phone?.value || props.phone || '').trim();
    
    // Função de limpeza inteligente para telefone
    const cleanPhone = (p: string) => {
      let num = (p || '').replace(/\D/g, '');
      // Se o número for brasileiro e começar com 55 (com mais de 10 dígitos no total), remove o 55 para deixar apenas DDD + Número
      if (num.startsWith('55') && num.length > 10) {
        num = num.slice(2);
      }
      return num;
    };
    
    const phone = cleanPhone(rawPhone);
    const firstname = (props.firstname?.value || props.firstname || '').trim();
    const lastname = (props.lastname?.value || props.lastname || '').trim();
    const name = `${firstname} ${lastname}`.trim() || 'Lead HubSpot';
    const company = (props.company?.value || props.company || '').trim();
    const role = (props.jobtitle?.value || props.jobtitle || '').trim();
    const source = (props.source?.value || props.source || 'HubSpot').trim();
    const customWorkspace = (payload.workspace || props.workspace || 'lottus').trim().toLowerCase();
    const incomingNotesText = (props.notes?.value || props.notes || '').trim();

    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: 'E-mail ou Telefone são obrigatórios para identificar o lead' }, { status: 400 });
    }

    // 2. Verificar se o lead já existe no workspace por E-mail ou por Telefone/WhatsApp
    let existingLead: any = null;
    
    if (email) {
      const { rows } = await sql`SELECT * FROM leads WHERE workspace = ${customWorkspace} AND LOWER(email) = ${email} LIMIT 1;`;
      if (rows.length > 0) existingLead = rows[0];
    }
    
    if (!existingLead && phone) {
      // Limpar caracteres não numéricos para comparação segura de telefone
      const cleanIncomingPhone = phone.replace(/\D/g, '');
      if (cleanIncomingPhone.length >= 8) {
        const { rows } = await sql`SELECT * FROM leads WHERE workspace = ${customWorkspace} LIMIT 100;`;
        existingLead = rows.find((l: any) => {
          const lPhone = (l.whatsapp || l.phone || '').replace(/\D/g, '');
          return lPhone && (lPhone.includes(cleanIncomingPhone) || cleanIncomingPhone.includes(lPhone));
        });
      }
    }

    const now = Date.now();
    let leadToSave: any = {};

    if (existingLead) {
      // ─── LEAD JÁ EXISTE: MESCLAGEM INTELIGENTE E PROTEÇÃO DE TIMELINE ───
      console.log(`Lead existente encontrado: ${existingLead.id} (${existingLead.name}). Mesclando dados...`);
      
      // Extrair timeline do banco
      const existingNotes = existingLead.notes || '';
      const existingMatch = existingNotes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/);
      let existingTimeline: any[] = [];
      if (existingMatch) {
        try { existingTimeline = JSON.parse(existingMatch[1]); } catch { existingTimeline = []; }
      }

      // Adicionar novo evento de integração à timeline
      const newEvent = {
        type: 'enrich',
        label: `Lead reengajado via HubSpot (${source})`,
        ts: now,
        notes: incomingNotesText ? `Novas info: ${incomingNotesText}` : undefined
      };
      
      existingTimeline.unshift(newEvent);

      // Limpar a tag [TIMELINE] do banco para isolar as notas de texto puro
      const cleanExistingNotes = existingNotes.replace(/\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/g, '').trim();

      // Mesclar notas textuais de forma elegante
      let finalNotesText = cleanExistingNotes;
      if (incomingNotesText && !cleanExistingNotes.includes(incomingNotesText)) {
        finalNotesText = `${incomingNotesText}\n\n[Histórico Anterior]\n${cleanExistingNotes}`;
      }

      // Montar objeto do lead atualizado
      leadToSave = {
        id: existingLead.id,
        workspace: existingLead.workspace,
        name: existingLead.name || name, // Preserva o nome do banco se já existir
        company: existingLead.company || company, // Atualiza apenas se estiver em branco
        role: existingLead.role || role,
        email: existingLead.email || email,
        whatsapp: existingLead.whatsapp || phone,
        phone: existingLead.phone || phone,
        source: existingLead.source || source,
        status: existingLead.status, // PRESERVA a etapa do funil de vendas atual
        notes: `${finalNotesText}\n\n[TIMELINE]${JSON.stringify(existingTimeline)}[/TIMELINE]`.trim(),
        call_count: existingLead.call_count || 0,
        last_contact: existingLead.last_contact,
        created_at: existingLead.created_at,
        updated_at: now
      };
    } else {
      // ─── LEAD NOVO: INICIALIZAÇÃO DE TIMELINE ───
      console.log(`Novo lead recebido do HubSpot: ${name} (${email || phone})`);
      
      const newLeadId = `lead_${now}_${Math.random().toString(36).slice(2, 7)}`;
      const initialTimeline = [
        {
          type: 'status',
          label: 'Etapa → Novo Lead',
          ts: now,
          from: null
        },
        {
          type: 'enrich',
          label: `Lead criado via integração HubSpot (${source})`,
          ts: now
        }
      ];

      leadToSave = {
        id: newLeadId,
        workspace: customWorkspace,
        name: name,
        company: company,
        role: role,
        email: email,
        whatsapp: phone,
        phone: phone,
        source: source,
        status: 'novo',
        notes: `${incomingNotesText}\n\n[TIMELINE]${JSON.stringify(initialTimeline)}[/TIMELINE]`.trim(),
        call_count: 0,
        last_contact: null,
        created_at: now,
        updated_at: now
      };
    }

    // Salvar o lead no banco de dados
    await upsertLead(leadToSave);

    return NextResponse.json({
      ok: true,
      message: existingLead ? 'Lead existente atualizado com sucesso' : 'Novo lead criado com sucesso',
      lead_id: leadToSave.id,
      action: existingLead ? 'updated' : 'created'
    });

  } catch (err: any) {
    console.error('Erro ao processar webhook do HubSpot:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
