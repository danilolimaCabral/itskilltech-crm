import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google';

export const dynamic = 'force-dynamic';

// GET /api/auth/google?workspace=lottus  → redireciona para o consentimento Google
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace') || 'lottus';

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.' },
      { status: 500 }
    );
  }

  const url = getAuthUrl(workspace);
  return NextResponse.redirect(url);
}
