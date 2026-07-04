// Vercel serverless function: POST /api/tts — neural narration via Gemini.
import { runTts, type TtsRequest } from './_lib/tts.js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }
  try {
    let body = req.body
    if (!body || typeof body === 'string') {
      const raw = typeof body === 'string' ? body : await readBody(req)
      body = raw ? JSON.parse(raw) : {}
    }
    const result = await runTts(body as TtsRequest, process.env.GEMINI_API_KEY)
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ audio: null, mime: '', error: err instanceof Error ? err.message : 'TTS failed' }))
  }
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c: Buffer) => { data += c })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}
