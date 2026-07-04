// Tiny shared key/value + list store for online multiplayer.
//
// In production it talks to Vercel KV / Upstash Redis over its REST API using
// the KV_REST_API_URL + KV_REST_API_TOKEN env vars. When those are absent (local
// `vite dev`, which runs every /api call inside one Node process) it falls back
// to a module-level in-memory store so multiplayer can be developed and tested
// on a single machine. The in-memory store does NOT work across Vercel's
// stateless function instances — production requires the KV env vars.

// Find the Upstash-compatible REST endpoint + token from the environment.
// Different integrations (Vercel KV, Upstash Marketplace) and optional custom
// prefixes name these differently, so match by suffix — e.g. KV_REST_API_URL,
// UPSTASH_REDIS_REST_URL, or STORAGE_KV_REST_API_URL all end the same way.
function findEnv(...suffixes: string[]): string | undefined {
  for (const [k, v] of Object.entries(process.env)) {
    if (v && suffixes.some(s => k.endsWith(s))) return v
  }
  return undefined
}
const URL = findEnv('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'REDIS_REST_URL')
const TOKEN = findEnv('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', 'REDIS_REST_TOKEN')
export const kvConfigured = !!(URL && TOKEN)

// ── In-memory fallback ────────────────────────────────────────────────────────
const mem = new Map<string, string>()
const memLists = new Map<string, string[]>()

// ── Upstash REST helper ───────────────────────────────────────────────────────
async function cmd<T = unknown>(args: (string | number)[]): Promise<T> {
  const res = await fetch(URL as string, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`KV error ${res.status}`)
  const json = await res.json() as { result: T }
  return json.result
}

const TTL = 60 * 60 * 24 * 3   // rooms auto-expire after 3 days of inactivity

export async function kvGet(key: string): Promise<string | null> {
  if (!kvConfigured) return mem.has(key) ? mem.get(key)! : null
  return cmd<string | null>(['GET', key])
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (!kvConfigured) { mem.set(key, value); return }
  await cmd(['SET', key, value, 'EX', TTL])
}

// Atomic claim — only succeeds if the key does not already exist.
export async function kvSetNX(key: string, value: string): Promise<boolean> {
  if (!kvConfigured) {
    if (mem.has(key)) return false
    mem.set(key, value); return true
  }
  const r = await cmd<'OK' | null>(['SET', key, value, 'NX', 'EX', TTL])
  return r === 'OK'
}

export async function kvDel(key: string): Promise<void> {
  if (!kvConfigured) { mem.delete(key); return }
  await cmd(['DEL', key])
}

// Append to a list (atomic).
export async function listPush(key: string, value: string): Promise<void> {
  if (!kvConfigured) {
    const l = memLists.get(key) ?? []
    l.push(value); memLists.set(key, l); return
  }
  await cmd(['RPUSH', key, value])
  await cmd(['EXPIRE', key, TTL])
}

// Read and clear a whole list in one shot (drain the inbox).
export async function listDrain(key: string): Promise<string[]> {
  if (!kvConfigured) {
    const l = memLists.get(key) ?? []
    memLists.set(key, [])
    return l
  }
  const items = await cmd<string[]>(['LRANGE', key, 0, -1])
  if (items && items.length) await cmd(['LTRIM', key, items.length, -1])
  return items ?? []
}
