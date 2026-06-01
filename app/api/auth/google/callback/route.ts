import { NextResponse } from 'next/server';
import { exchangeCode, getUserEmail, getBaseUrl } from '@/lib/google';
import { saveAccount } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

// GET /api/auth/google/callback?code=...&state=workspace
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const workspace = searchParams.get('state') || 'lottus';
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${getBaseUrl()}/?auth=error`);
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await getUserEmail(tokens);
    saveAccount(workspace, { email, tokens });
    return NextResponse.redirect(`${getBaseUrl()}/?auth=ok&ws=${workspace}`);
  } catch (e: any) {
    console.error('OAuth callback error:', e.message);
    return NextResponse.redirect(`${getBaseUrl()}/?auth=error`);
  }
}
