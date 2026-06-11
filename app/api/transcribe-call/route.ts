import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
// Aumentar limite de tamanho do body para áudio
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const workspace = (formData.get('workspace') as string) || 'lottus'

    if (!audioFile) {
      return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key não configurada' }, { status: 503 })
    }

    // Converter File para Buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Calcular duração aproximada (webm ~16kbps)
    const durationSecs = Math.round(buffer.length / (16000 / 8))
    const durationStr = durationSecs > 60
      ? `${Math.floor(durationSecs / 60)}min ${durationSecs % 60}s`
      : `${durationSecs}s`

    // Chamar Whisper via OpenAI API
    const whisperForm = new FormData()
    const blob = new Blob([buffer], { type: audioFile.type || 'audio/webm' })
    whisperForm.append('file', blob, audioFile.name || 'ligacao.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'pt')
    whisperForm.append('response_format', 'json')
    whisperForm.append('prompt', 'Transcrição de ligação comercial B2B sobre software de gestão de transporte (TMS) para logística. Empresa: getLOG/Lottustech.')

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.manus.im/api/llm-proxy/v1'

    const whisperRes = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const errText = await whisperRes.text()
      console.error('[Whisper] Erro:', errText)

      // Fallback: tentar com OpenAI direto
      const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: whisperForm,
      })

      if (!openaiRes.ok) {
        return NextResponse.json({
          error: 'Erro na transcrição. Verifique se o áudio foi gravado corretamente.',
          details: errText
        }, { status: 500 })
      }

      const openaiData = await openaiRes.json()
      return NextResponse.json({
        ok: true,
        text: openaiData.text || '',
        duration: durationStr,
        model: 'whisper-1',
        workspace,
      })
    }

    const data = await whisperRes.json()

    return NextResponse.json({
      ok: true,
      text: data.text || '',
      duration: durationStr,
      model: 'whisper-1',
      workspace,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[transcribe-call] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
