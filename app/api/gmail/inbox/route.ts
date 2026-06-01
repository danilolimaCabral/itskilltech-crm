import { NextResponse } from 'next/server';
import { gmailClient } from '@/lib/google';
import { getAccount } from '@/lib/accounts';

export const dynamic = 'force-dynamic';

function header(headers: any[], name: string) {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

// GET /api/gmail/inbox?workspace=lottus&q=...&max=20
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get('workspace') || 'lottus';
    const q = searchParams.get('q') || ''; // ex: "from:cliente@x.com" ou vazio
    const max = parseInt(searchParams.get('max') || '20', 10);

    const account = getAccount(workspace);
    if (!account) {
      return NextResponse.json({ ok: false, error: 'Conta não conectada', messages: [] }, { status: 401 });
    }

    const gmail = gmailClient(account.tokens);
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: max, q: q || undefined });
    const ids = (list.data.messages || []).map((m) => m.id!);

    // Busca os metadados de cada mensagem
    const messages = await Promise.all(
      ids.map(async (id) => {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });
        const h = msg.data.payload?.headers || [];
        return {
          id,
          threadId: msg.data.threadId,
          from: header(h, 'From'),
          to: header(h, 'To'),
          subject: header(h, 'Subject'),
          date: header(h, 'Date'),
          snippet: msg.data.snippet || '',
          unread: (msg.data.labelIds || []).includes('UNREAD'),
        };
      })
    );

    return NextResponse.json({ ok: true, email: account.email, messages });
  } catch (e: any) {
    console.error('Inbox error:', e.message);
    return NextResponse.json({ ok: false, error: e.message, messages: [] }, { status: 500 });
  }
}
