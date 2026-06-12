import { NextRequest, NextResponse } from 'next/server';
import { upsertLead } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CNPJA_KEY = process.env.CNPJA_API_KEY || '';

// Gerar e-mail estimado se a empresa não tiver e-mail cadastrado
function guessEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+(ltda|me|sa|s\.a|eireli|epp|ss|sss|comercio|industria|servicos|solucoes|brasil|do|da|de|e|em|para|com|the)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  if (!slug) return '';
  return `contato@${slug}.com.br`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cnpj = searchParams.get('cnpj')?.replace(/\D/g, '');

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ inválido. Digite 14 números.' }, { status: 400 });
    }

    // 1. Buscar na API CNPJ.já (se tiver chave) ou na API pública da Receita Federal (BrasilAPI/ReceitaWS)
    let companyData: any = null;

    if (CNPJA_KEY) {
      try {
        const res = await fetch(`https://api.cnpja.com/office/${cnpj}`, {
          headers: { Authorization: CNPJA_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          companyData = {
            name: data.alias || data.company?.name || '',
            company: data.company?.name || data.alias || '',
            email: data.emails?.[0]?.address || '',
            phone: data.phones?.[0] ? `(${data.phones[0].area}) ${data.phones[0].number}` : '',
            city: data.address?.city || '',
            state: data.address?.state || '',
            cnae: data.mainActivity?.text || '',
            size: data.company?.size?.text || '',
            cnpj: cnpj,
          };
        }
      } catch (err) {
        console.error('Erro ao buscar na CNPJA:', err);
      }
    }

    // Fallback para BrasilAPI (público, gratuito e sem chave)
    if (!companyData) {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (res.ok) {
          const data = await res.json();
          companyData = {
            name: data.nome_fantasia || data.razao_social || '',
            company: data.razao_social || data.nome_fantasia || '',
            email: data.email || '',
            phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0,2)}) ${data.ddd_telefone_1.slice(2)}` : '',
            city: data.municipio || '',
            state: data.uf || '',
            cnae: data.cnae_fiscal_descricao || '',
            size: data.porte || '',
            cnpj: cnpj,
          };
        }
      } catch (err) {
        console.error('Erro ao buscar na BrasilAPI:', err);
      }
    }

    if (!companyData) {
      return NextResponse.json({ error: 'Não foi possível encontrar dados para este CNPJ. Verifique se o número está correto.' }, { status: 404 });
    }

    // Se não tiver e-mail, estimar um
    if (!companyData.email) {
      companyData.email = guessEmail(companyData.name || companyData.company);
    }

    return NextResponse.json({ success: true, company: companyData });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead, workspace } = body;

    if (!lead || !workspace) {
      return NextResponse.json({ error: 'Dados do lead e workspace são obrigatórios.' }, { status: 400 });
    }

    // Gerar um ID único para o lead
    const leadId = 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    // Montar o objeto do lead
    const newLead = {
      id: leadId,
      workspace: workspace,
      name: lead.name || 'Decisor',
      company: lead.company || '',
      role: lead.role || 'Diretor de Logística',
      email: lead.email || '',
      whatsapp: lead.whatsapp || '',
      phone: lead.phone || '',
      linkedin: lead.linkedin || '',
      source: 'Busca CNPJ',
      status: 'novo',
      notes: `CNPJ: ${lead.cnpj || ''}\nCNAE: ${lead.cnae || ''}\nCidade: ${lead.city || ''}/${lead.state || ''}\nPorte: ${lead.size || ''}`,
      call_count: 0,
      last_contact: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    // Salvar no banco de dados
    await upsertLead(newLead);

    return NextResponse.json({ success: true, lead: newLead });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
