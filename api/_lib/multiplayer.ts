// Online multiplayer — host-authoritative relay.
//
// The HOST device runs the real game engine (the existing client store) and,
// after every change, uploads the full game state here via `publish`. The server
// splits that state into a per-nation VIEW that hides every other player's secret
// information (their un-revealed orders, spy orders, production and PINs) and
// stores one view per nation. A remote player can only ever fetch THEIR own view
// (guarded by their PIN), so no device receives another player's secrets.
//
// Remote players send actions (submit order, diplomacy, lock, purchase, …) to an
// inbox list; the host drains it each tick, applies the actions through the same
// validated store logic a local game uses, then publishes again.

import { kvGet, kvSet, kvSetNX, listPush, listDrain, kvConfigured } from './store.js'

const NATIONS = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

type Seat = { type: 'ai' | 'human' | 'open' | 'off'; name?: string; pin?: string; claimed?: boolean }
type Room = {
  code: string
  name: string
  hostToken: string
  seats: Record<string, Seat>
  started: boolean
  round: number
  phase: string
  dateLabel: string
  winner: string | null
  updatedAt: number
}

const roomKey = (code: string) => `ww2:room:${code}`
const viewKey = (code: string, nation: string) => `ww2:view:${code}:${nation}`
const inboxKey = (code: string) => `ww2:inbox:${code}`

function code5(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // no easily-confused chars
  let s = ''
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

async function getRoom(code: string): Promise<Room | null> {
  const raw = await kvGet(roomKey(code))
  return raw ? JSON.parse(raw) as Room : null
}
async function putRoom(room: Room): Promise<void> {
  room.updatedAt = Date.now()
  await kvSet(roomKey(room.code), JSON.stringify(room))
}

// Public room info (no PINs, no host token) — for the lobby / waiting room.
function publicRoom(room: Room) {
  const seats: Record<string, { type: string; name?: string; claimed?: boolean }> = {}
  for (const [n, s] of Object.entries(room.seats)) seats[n] = { type: s.type, name: s.name, claimed: s.claimed }
  return {
    code: room.code, name: room.name, seats, started: room.started,
    round: room.round, phase: room.phase, dateLabel: room.dateLabel, winner: room.winner,
  }
}

// Strip every other nation's secrets from a full game state for `nation`.
function filterStateFor(state: any, nation: string): any {
  const g = JSON.parse(JSON.stringify(state))
  // Secret, per-nation collections: keep only this nation's.
  if (g.orders) g.orders = { [nation]: g.orders[nation] ?? [] }
  if (Array.isArray(g.standingOrders)) g.standingOrders = g.standingOrders.filter((o: any) => o.nation === nation)
  if (Array.isArray(g.spyOrders)) g.spyOrders = g.spyOrders.filter((o: any) => o.spy === nation)
  if (Array.isArray(g.spyReports)) g.spyReports = g.spyReports.filter((r: any) => r.spy === nation)
  if (g.productionQueues) g.productionQueues = { [nation]: g.productionQueues[nation] ?? [] }
  // Never expose anyone's PIN.
  if (g.players) for (const p of Object.values(g.players) as any[]) if (p) delete p.pin
  return g
}

// ── Operations ────────────────────────────────────────────────────────────────
export type MpRequest = { op: string; [k: string]: any }

export async function runMultiplayer(req: MpRequest): Promise<any> {
  switch (req.op) {
    case 'create': return create(req)
    case 'room': return roomInfo(req)
    case 'join': return join(req)
    case 'start': return publish(req, true)
    case 'publish': return publish(req, false)
    case 'view': return view(req)
    case 'act': return act(req)
    case 'pull': return pull(req)
    default: return { error: `Unknown op ${req.op}` }
  }
}

async function create(req: MpRequest) {
  const seats: Record<string, Seat> = {}
  for (const n of NATIONS) {
    const s = req.seats?.[n]
    seats[n] = s ? { type: s.type, name: s.name, claimed: false } : { type: 'open' }
  }
  let code = code5()
  for (let i = 0; i < 5 && (await getRoom(code)); i++) code = code5()
  const room: Room = {
    code, name: req.name || 'Online War', hostToken: token(), seats,
    started: false, round: 1, phase: 'lobby', dateLabel: '', winner: null, updatedAt: Date.now(),
  }
  await putRoom(room)
  return { code, hostToken: room.hostToken, kv: kvConfigured }
}

async function roomInfo(req: MpRequest) {
  const room = await getRoom(req.code)
  if (!room) return { error: 'No such game code' }
  return { room: publicRoom(room) }
}

async function join(req: MpRequest) {
  const { code, nation, name, pin } = req
  const room = await getRoom(code)
  if (!room) return { error: 'No such game code' }
  const seat = room.seats[nation]
  if (!seat) return { error: 'Unknown nation' }
  if (seat.type === 'ai' || seat.type === 'off') return { error: `${nation} is not an open seat` }
  // Atomically claim the seat so two people can't grab the same nation.
  const claimed = await kvSetNX(`ww2:claim:${code}:${nation}`, pin || '0000')
  if (!claimed) {
    // Allow the same player to re-join with the matching PIN (reconnect).
    const existing = await kvGet(`ww2:claim:${code}:${nation}`)
    if (existing !== (pin || '0000')) return { error: `${nation} is already taken` }
  }
  seat.type = 'human'; seat.name = name || nation; seat.pin = pin || '0000'; seat.claimed = true
  await putRoom(room)
  return { ok: true, room: publicRoom(room) }
}

async function publish(req: MpRequest, starting: boolean) {
  const room = await getRoom(req.code)
  if (!room) return { error: 'No such game code' }
  if (req.hostToken !== room.hostToken) return { error: 'Not the host' }
  const state = req.state
  if (!state) return { error: 'Missing state' }
  // Write one hidden-info view per nation.
  await Promise.all(NATIONS.map(n => kvSet(viewKey(room.code, n), JSON.stringify(filterStateFor(state, n)))))
  room.started = true
  room.round = state.round; room.phase = state.phase
  room.dateLabel = req.dateLabel || room.dateLabel
  room.winner = state.winner ?? null
  await putRoom(room)
  return { ok: true, starting }
}

async function view(req: MpRequest) {
  const { code, nation, pin } = req
  const room = await getRoom(code)
  if (!room) return { error: 'No such game code' }
  const seat = room.seats[nation]
  if (seat?.type === 'human' && seat.pin && seat.pin !== pin) return { error: 'Wrong PIN' }
  const raw = await kvGet(viewKey(code, nation))
  return { room: publicRoom(room), state: raw ? JSON.parse(raw) : null }
}

async function act(req: MpRequest) {
  const { code, nation, pin, action } = req
  const room = await getRoom(code)
  if (!room) return { error: 'No such game code' }
  const seat = room.seats[nation]
  if (!seat || seat.type !== 'human') return { error: 'You do not control that nation' }
  if (seat.pin && seat.pin !== pin) return { error: 'Wrong PIN' }
  await listPush(inboxKey(code), JSON.stringify({ nation, action, ts: Date.now() }))
  return { ok: true }
}

async function pull(req: MpRequest) {
  const room = await getRoom(req.code)
  if (!room) return { error: 'No such game code' }
  if (req.hostToken !== room.hostToken) return { error: 'Not the host' }
  const raw = await listDrain(inboxKey(req.code))
  return { actions: raw.map(s => JSON.parse(s)) }
}
