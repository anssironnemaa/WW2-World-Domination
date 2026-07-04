// Online multiplayer client — talks to the /api/game relay.
// The HOST runs the real engine and publishes per-nation views; guests fetch
// their own view and send actions. See api/_lib/multiplayer.ts.
import type { GameState, Nation, PlayerType } from '../data/types'

export type SeatConfig = Record<string, { type: 'ai' | 'human' }>

async function api<T = any>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/api/game', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, ...body }),
  })
  return res.json() as Promise<T>
}

export type RoomInfo = {
  code: string; name: string; started: boolean; round: number; phase: string
  dateLabel: string; winner: string | null
  seats: Record<string, { type: string; name?: string; claimed?: boolean }>
}

export const mp = {
  create: (name: string, seats: SeatConfig) =>
    api<{ code: string; hostToken: string; kv: boolean }>('create', { name, seats }),
  room: (code: string) => api<{ room?: RoomInfo; error?: string }>('room', { code }),
  join: (code: string, nation: string, name: string, pin: string) =>
    api<{ ok?: boolean; room?: RoomInfo; error?: string }>('join', { code, nation, name, pin }),
  start: (code: string, hostToken: string, state: GameState, dateLabel: string) =>
    api('start', { code, hostToken, state, dateLabel }),
  publish: (code: string, hostToken: string, state: GameState, dateLabel: string) =>
    api('publish', { code, hostToken, state, dateLabel }),
  view: (code: string, nation: string, pin: string) =>
    api<{ room?: RoomInfo; state?: GameState | null; error?: string }>('view', { code, nation, pin }),
  act: (code: string, nation: string, pin: string, action: { type: string; payload?: any }) =>
    api<{ ok?: boolean; error?: string }>('act', { code, nation, pin, action }),
  pull: (code: string, hostToken: string) =>
    api<{ actions?: { nation: Nation; action: { type: string; payload?: any } }[]; error?: string }>('pull', { code, hostToken }),
}

// The player config the host uses to initialise the engine: its own nation is a
// human it controls; remote-human seats are also 'human' (their orders arrive
// via the inbox); AI seats are 'ai'.
export function seatsToPlayerConfig(
  seats: SeatConfig, hostNation: Nation, hostPin: string,
): Record<Nation, { type: PlayerType; pin: string }> {
  const cfg = {} as Record<Nation, { type: PlayerType; pin: string }>
  for (const [n, s] of Object.entries(seats)) {
    cfg[n as Nation] = {
      type: s.type,
      pin: n === hostNation ? hostPin : '',
    }
  }
  return cfg
}
