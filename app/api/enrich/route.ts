import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Rota legada: fazia busca de pessoas com telefone sem um teto de créditos explícito.
// O fluxo suportado é /api/prospect, que valida papel master e teto antes de revelar email profissional.
export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: 'Login obrigatório.' }, { status: 401 });
  if (session.role !== 'master') return NextResponse.json({ ok: false, error: 'Apenas perfil master pode acessar funções Apollo.' }, { status: 403 });

  return NextResponse.json({
    ok: false,
    error: 'Enrichment legado desativado. Use Buscar Leads > Apollo para revelar emails profissionais com teto explícito de créditos.',
  }, { status: 410 });
}
