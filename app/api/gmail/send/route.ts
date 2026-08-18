import { NextResponse } from 'next/server';
import { gmailClient } from '@/lib/google';
import { getAccount } from '@/lib/accounts';
import { resolveWorkspace } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Monta uma mensagem RFC 2822 e codifica em base64url
function buildRawEmail(from: string, to: string, subject: string, body: string) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// POST /api/gmail/send  { workspace, to, subject, body }
export async function POST(req: Request) {
  try {
    const { workspace: requestedWorkspace, to, subject, body } = await req.json();
    const access = await resolveWorkspace(req, requestedWorkspace);
    if (!access.workspace) return NextResponse.json({ ok: false, error: access.error }, { status: access.session ? 403 : 401 });
    const workspace = access.workspace;
    const account = getAccount(workspace);
    if (!account) {
      return NextResponse.json({ ok: false, error: 'Conta não conectada para este workspace' }, { status: 401 });
    }

    const gmail = gmailClient(account.tokens);
    const raw = buildRawEmail(account.email, to, subject || '', body || '');
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });

    return NextResponse.json({ ok: true, id: res.data.id, from: account.email });
  } catch (e: any) {
    console.error('Send error:', e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
