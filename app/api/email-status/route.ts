import { NextResponse } from 'next/server'

export async function GET() {
  const configured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  return NextResponse.json({ configured, user: configured ? process.env.GMAIL_USER : null })
}
