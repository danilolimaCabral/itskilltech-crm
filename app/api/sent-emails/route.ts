import { NextRequest, NextResponse } from 'next/server'
import { getLeads } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workspace = searchParams.get('workspace') || 'lottus'
    const search = (searchParams.get('search') || '').toLowerCase()
    const limit = parseInt(searchParams.get('limit') || '300')

    // Buscar todos os leads do workspace
    const leads = await getLeads(workspace)

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

    for (const lead of leads) {
      const notes = (lead as any).notes || ''
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
          const subject = (event.label || '').replace('E-mail enviado: ', '') || '(sem assunto)'
          const entry = {
            id: `${lead.id}_${event.ts}`,
            leadId: lead.id,
            leadName: (lead as any).name || '',
            leadCompany: (lead as any).company || '',
            leadEmail: (lead as any).email || '',
            leadRole: (lead as any).role || '',
            subject,
            ts: event.ts || 0,
            type: 'email',
            opened: event.opened || false,
            resend_id: event.resend_id || null,
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
