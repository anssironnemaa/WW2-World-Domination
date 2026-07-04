// Vercel serverless function: POST /api/game — online multiplayer relay.
import { runMultiplayer, type MpRequest } from './_lib/multiplayer.js'

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
    const result = await runMultiplayer(body as MpRequest)
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Multiplayer error' }))
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
