import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/accounts';
import { calendarClient } from '@/lib/google';

export const dynamic = 'force-dynamic';

// ─── GET /api/calendar?workspace=lottus&date=2026-06-03 ─────────────────────
// Retorna os slots livres do dia para o usuário autenticado
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspace = searchParams.get('workspace') || 'lottus';
  const dateStr = searchParams.get('date'); // YYYY-MM-DD

  const account = getAccount(workspace);
  if (!account) {
    return NextResponse.json({ error: 'Google não conectado. Conecte sua conta em Configurações.' }, { status: 401 });
  }

  const cal = calendarClient(account.tokens);

  // Janela do dia inteiro (ou próximos 7 dias se não informar data)
  const start = dateStr
    ? new Date(`${dateStr}T00:00:00`)
    : new Date();
  const end = dateStr
    ? new Date(`${dateStr}T23:59:59`)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Busca eventos ocupados no período
    const freebusyRes = await cal.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busy: Array<{ start?: string | null; end?: string | null }> =
      freebusyRes.data.calendars?.primary?.busy || [];

    // Gera slots de 30 min das 08:00 às 18:00 no dia solicitado
    const slots: Array<{ time: string; available: boolean }> = [];
    const dayStart = dateStr ? new Date(`${dateStr}T08:00:00`) : new Date();
    if (!dateStr) {
      dayStart.setHours(8, 0, 0, 0);
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(18, 0, 0, 0);

    const cursor = new Date(dayStart);
    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
      const isBusy = busy.some((b) => {
        if (!b.start || !b.end) return false;
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return cursor < be && slotEnd > bs;
      });
      slots.push({
        time: cursor.toISOString(),
        available: !isBusy,
      });
      cursor.setTime(cursor.getTime() + 30 * 60 * 1000);
    }

    return NextResponse.json({ slots, busy, ownerEmail: account.email });
  } catch (e: any) {
    console.error('Calendar freebusy error:', e.message);
    return NextResponse.json({ error: 'Erro ao consultar agenda: ' + e.message }, { status: 500 });
  }
}

// ─── POST /api/calendar ───────────────────────────────────────────────────────
// Cria evento no Google Calendar e envia invite para o convidado
export async function POST(req: Request) {
  const body = await req.json();
  const {
    workspace = 'lottus',
    guestEmail,           // e-mail do lead/convidado
    guestName,            // nome do lead
    startTime,            // ISO string
    endTime,              // ISO string (padrão: startTime + 1h)
    title,                // título do evento
    description,          // pauta / notas
    meetLink = true,      // criar Google Meet automaticamente
  } = body;

  if (!guestEmail || !startTime) {
    return NextResponse.json({ error: 'guestEmail e startTime são obrigatórios' }, { status: 400 });
  }

  const account = getAccount(workspace);
  if (!account) {
    return NextResponse.json({ error: 'Google não conectado. Conecte sua conta em Configurações.' }, { status: 401 });
  }

  const cal = calendarClient(account.tokens);

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);

  const eventTitle = title || `Reunião com ${guestName || guestEmail}`;

  try {
    const event = await cal.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all', // envia invite por e-mail para todos os convidados
      requestBody: {
        summary: eventTitle,
        description: description || '',
        start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
        attendees: [
          { email: account.email, displayName: 'Organizador', organizer: true },
          { email: guestEmail, displayName: guestName || guestEmail },
        ],
        conferenceData: meetLink
          ? {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            }
          : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      },
      conferenceDataVersion: meetLink ? 1 : 0,
    });

    const meetUrl =
      event.data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')
        ?.uri || null;

    return NextResponse.json({
      ok: true,
      eventId: event.data.id,
      eventLink: event.data.htmlLink,
      meetUrl,
      title: event.data.summary,
      start: event.data.start?.dateTime,
      end: event.data.end?.dateTime,
    });
  } catch (e: any) {
    console.error('Calendar create event error:', e.message);
    return NextResponse.json({ error: 'Erro ao criar evento: ' + e.message }, { status: 500 });
  }
}
