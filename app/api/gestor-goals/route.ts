import { NextRequest, NextResponse } from 'next/server';
import { getDailyGoals, upsertDailyGoals, initGestorTables } from '@/lib/db';

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace') || 'lottus';
  await initGestorTables();
  const goals = await getDailyGoals(workspace);
  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { workspace, ...goals } = body;
  await initGestorTables();
  const result = await upsertDailyGoals(workspace || 'lottus', goals);
  return NextResponse.json({ ok: true, goals: result });
}
