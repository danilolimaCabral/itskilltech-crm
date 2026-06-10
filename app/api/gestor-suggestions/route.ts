import { NextRequest, NextResponse } from 'next/server';
import { getManagerSuggestions, insertManagerSuggestion, markSuggestionRead, initGestorTables } from '@/lib/db';

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace') || 'lottus';
  await initGestorTables();
  const suggestions = await getManagerSuggestions(workspace);
  return NextResponse.json(suggestions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  await initGestorTables();
  if (body.action === 'read') {
    await markSuggestionRead(body.id);
    return NextResponse.json({ ok: true });
  }
  const suggestion = {
    id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspace: body.workspace || 'lottus',
    message: body.message,
    from_name: body.from_name || 'Vandir',
    priority: body.priority || 'normal',
  };
  await insertManagerSuggestion(suggestion);
  return NextResponse.json({ ok: true, suggestion });
}
