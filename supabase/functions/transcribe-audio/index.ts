// Deno edge function. Deploy with: supabase functions deploy transcribe-audio
// Requires OPENAI_API_KEY set as a function secret (see README.md).
//
// Transcribes a recorded voice note via OpenAI Whisper. The transcript is
// then handed to extract-deal (same prompt as screenshot intake) by the client.

import { corsHeaders } from '../_shared/cors.ts'

interface RequestBody {
  audioBase64: string
  mimeType: string
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('webm')) return 'webm'
  return 'm4a'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server is missing OPENAI_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { audioBase64, mimeType }: RequestBody = await req.json()
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'Provide audioBase64' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const bytes = base64ToBytes(audioBase64)
    const ext = extensionFor(mimeType || '')

    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mimeType || 'audio/m4a' }), `voice-note.${ext}`)
    form.append('model', 'whisper-1')

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI transcription error:', errText)
      return new Response(JSON.stringify({ error: 'Transcription failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await openaiRes.json()
    const transcript = typeof result.text === 'string' ? result.text.trim() : ''

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('transcribe-audio error:', err)
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
