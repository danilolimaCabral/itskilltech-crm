import { NextRequest, NextResponse } from 'next/server'
import { getLeads, upsertLead } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/save-call-transcription
// Salva a transcrição de uma ligação na timeline do lead
export async function POST(req: NextRequest) {
  try {
    const { leadId, workspace, transcription, duration, callId } = await req.json()

    if (!leadId || !transcription) {
      return NextResponse.json({ error: 'leadId e transcription são obrigatórios' }, { status: 400 })
    }

    const ws = workspace || 'lottus'

    // Buscar o lead
    const leads = await getLeads(ws)
    const lead = leads.find((l: any) => l.id === leadId)

    if (!lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Montar evento de timeline
    const now = Date.now()
    const timeLabel = new Date(now).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

    const newEvent = {
      type: 'call',
      ts: now,
      label: `📞 Ligação gravada${duration ? ` (${duration})` : ''} — ${timeLabel}`,
      transcription: transcription,
      callId: callId || `call-${now}`,
      duration: duration || '',
    }

    // Ler timeline existente
    const notes = (lead as any).notes || ''
    let timeline: any[] = []

    const timelineMatch = notes.match(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/)
    if (timelineMatch) {
      try {
        timeline = JSON.parse(timelineMatch[1])
      } catch {
        timeline = []
      }
    }

    // Adicionar novo evento
    timeline.unshift(newEvent)

    // Reconstruir notes
    const timelineJson = JSON.stringify(timeline)
    let newNotes: string
    if (timelineMatch) {
      newNotes = notes.replace(
        /\[TIMELINE\][\s\S]*?\[\/TIMELINE\]/,
        `[TIMELINE]${timelineJson}[/TIMELINE]`
      )
    } else {
      newNotes = notes + `\n[TIMELINE]${timelineJson}[/TIMELINE]`
    }

    // Atualizar o lead
    const updatedLead = {
      ...(lead as any),
      notes: newNotes,
      lastContact: new Date(now).toISOString().split('T')[0],
      workspace: ws,
    }

    await upsertLead(updatedLead)

    return NextResponse.json({
      ok: true,
      message: `Transcrição salva na timeline de ${(lead as any).name || leadId}`,
      leadName: (lead as any).name || '',
      company: (lead as any).company || '',
      duration: duration || '',
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[save-call-transcription] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
