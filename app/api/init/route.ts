import { NextResponse } from 'next/server';
import { hasDatabase, initDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!hasDatabase) {
    return NextResponse.json({ hasDatabase: false, ok: false, reason: 'no-database' });
  }
  try {
    const result = await initDatabase();
    return NextResponse.json({ hasDatabase: true, ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ hasDatabase: true, ok: false, error: e.message }, { status: 500 });
  }
}
