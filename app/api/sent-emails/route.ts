import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get('workspace') || 'lottus'
    const search = (searchParams.get('search') || '').toLowerCase()
    const limit = parseInt(searchParams.get('limit') || '200')

    const db = await getDb()

    // Buscar todos os leads do workspace que têm timeline
    const leads = await db.execute(
      `SELECT id, name, company, email, role, notes FROM leads WHERE workspace = ? AND notes LIKE '%[TIMELINE]%' ORDER BY updated_at DESC LIMIT 1000`,
      [workspace]
    )

    const sentEmails: {
      id: string
      leadId: string
      leadName: string
      leadCompany: string
      leadEmail: string
      leadRole: string
      subject: string
      ts: number
      type: string
      opened: boolean
    }[] = []

    for (const lead of (leads.rows as any[])) {
      const notes = lead.notes || ''
      const timelineMatch = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)
      if (!timelineMatch) continue

      let timeline: any[] = []
      try {
        timeline = JSON.parse(timelineMatch[1])
      } catch {
        continue
      }

      for (const event of timeline) {
        if (event.type === 'email') {
          const subject = event.label?.replace('E-mail enviado: ', '') || '(sem assunto)'
          const entry = {
            id: `${lead.id}_${event.ts}`,
            leadId: lead.id,
            leadName: lead.name || '',
            leadCompany: lead.company || '',
            leadEmail: lead.email || '',
            leadRole: lead.role || '',
            subject,
            ts: event.ts || 0,
            type: 'email',
            opened: event.opened || false,
          }

          // Filtro de busca
          if (search) {
            const haystack = `${entry.leadName} ${entry.leadCompany} ${entry.leadEmail} ${entry.subject}`.toLowerCase()
            if (!haystack.includes(search)) continue
          }

          sentEmails.push(entry)
        }
      }
    }

    // Ordenar por data mais recente
    sentEmails.sort((a, b) => b.ts - a.ts)

    return NextResponse.json({
      ok: true,
      total: sentEmails.length,
      emails: sentEmails.slice(0, limit),
    })
  } catch (error: unknown) {
    console.error('Erro ao listar e-mails enviados:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
