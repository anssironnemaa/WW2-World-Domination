// Vercel serverless function: POST /api/ai-move
// Holds the Gemini key server-side (process.env.GEMINI_API_KEY) so it is never
// exposed to the browser. Falls back to the deterministic mock when no key is set.
import { runAiMove, type Briefing } from './_lib/aiMove.js'

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
    const result = await runAiMove(body as Briefing, process.env.GEMINI_API_KEY)
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'AI move failed' }))
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
