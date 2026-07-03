// Diplomacy command parser — the bracketed command syntax from the rulebook.
//   [ALLIANCE: P1, P2]
//   [TRANSFER: X IPC, FROM: STATE, TO: STATE, ROUTE: AREA]
//   [NON-AGGRESSION: N rounds, PARTIES: S1, S2]
//   [MERCENARY: X IPC, UNIT: TYPE, OWNER: STATE, HIRER: STATE]
import type { Nation } from '../data/types'
import { UNIT_TYPES } from '../data/units'

export type ParsedCommand =
  | { kind: 'ALLIANCE'; parties: Nation[] }
  | { kind: 'TRANSFER'; ipc: number; from: Nation; to: Nation; route: string }
  | { kind: 'NON-AGGRESSION'; rounds: number; parties: Nation[] }
  | { kind: 'MERCENARY'; ipc: number; unit: string; owner: Nation; hirer: Nation }

export type ParseResult =
  | { ok: true; command: ParsedCommand }
  | { ok: false; error: string }

const NATION_ALIASES: Record<string, Nation> = {
  germany: 'Germany', saksa: 'Germany', ger: 'Germany',
  ussr: 'USSR', soviet: 'USSR', neuvostoliitto: 'USSR', 'soviet union': 'USSR',
  uk: 'UK', britain: 'UK', 'iso-britannia': 'UK', england: 'UK',
  usa: 'USA', 'united states': 'USA', yhdysvallat: 'USA',
  japan: 'Japan', japani: 'Japan',
  france: 'France', ranska: 'France',
  italy: 'Italy', italia: 'Italy',
}

function toNation(raw: string): Nation | null {
  return NATION_ALIASES[raw.trim().toLowerCase()] ?? null
}

function toUnit(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  if (UNIT_TYPES[key]) return key
  // match Finnish or English display names
  const found = Object.values(UNIT_TYPES).find(u =>
    u.nameFI.toLowerCase() === key || u.id === key)
  return found?.id ?? null
}

export function parseCommand(input: string): ParseResult {
  const trimmed = input.trim().replace(/^\[|\]$/g, '').trim()
  const colon = trimmed.indexOf(':')
  if (colon === -1) return { ok: false, error: 'Missing ":" — use [KIND: …]' }

  const kind = trimmed.slice(0, colon).trim().toUpperCase()
  const body = trimmed.slice(colon + 1).trim()

  if (kind === 'ALLIANCE') {
    const parties = body.split(',').map(toNation)
    if (parties.some(p => p === null) || parties.length < 2)
      return { ok: false, error: 'ALLIANCE needs ≥2 valid nations' }
    return { ok: true, command: { kind: 'ALLIANCE', parties: parties as Nation[] } }
  }

  if (kind === 'TRANSFER') {
    const ipc = Number(body.match(/(\d+)\s*IPC/i)?.[1])
    const from = toNation(body.match(/FROM:\s*([^,]+)/i)?.[1] ?? '')
    const to = toNation(body.match(/TO:\s*([^,]+)/i)?.[1] ?? '')
    const route = (body.match(/ROUTE:\s*([^,]+)/i)?.[1] ?? '').trim()
    if (!ipc || ipc <= 0) return { ok: false, error: 'TRANSFER needs "X IPC"' }
    if (!from || !to) return { ok: false, error: 'TRANSFER needs FROM: and TO: nations' }
    if (from === to) return { ok: false, error: 'FROM and TO must differ' }
    return { ok: true, command: { kind: 'TRANSFER', ipc, from, to, route } }
  }

  if (kind === 'NON-AGGRESSION' || kind === 'NONAGGRESSION') {
    const rounds = Number(body.match(/(\d+)\s*round/i)?.[1])
    const parties = (body.match(/PARTIES:\s*(.+)$/i)?.[1] ?? '').split(',').map(toNation)
    if (!rounds || rounds <= 0) return { ok: false, error: 'NON-AGGRESSION needs "N rounds"' }
    if (parties.some(p => p === null) || parties.length < 2)
      return { ok: false, error: 'NON-AGGRESSION needs PARTIES: with ≥2 nations' }
    return { ok: true, command: { kind: 'NON-AGGRESSION', rounds, parties: parties as Nation[] } }
  }

  if (kind === 'MERCENARY') {
    const ipc = Number(body.match(/(\d+)\s*IPC/i)?.[1])
    const unit = toUnit(body.match(/UNIT:\s*([^,]+)/i)?.[1] ?? '')
    const owner = toNation(body.match(/OWNER:\s*([^,]+)/i)?.[1] ?? '')
    const hirer = toNation(body.match(/HIRER:\s*([^,]+)/i)?.[1] ?? '')
    if (!ipc || ipc <= 0) return { ok: false, error: 'MERCENARY needs "X IPC"' }
    if (!unit) return { ok: false, error: 'MERCENARY needs a valid UNIT:' }
    if (!owner || !hirer) return { ok: false, error: 'MERCENARY needs OWNER: and HIRER:' }
    if (owner === hirer) return { ok: false, error: 'OWNER and HIRER must differ' }
    return { ok: true, command: { kind: 'MERCENARY', ipc, unit, owner, hirer } }
  }

  return { ok: false, error: `Unknown command "${kind}"` }
}

export function areAllied(alliances: { parties: Nation[] }[], a: Nation, b: Nation): boolean {
  return alliances.some(al => al.parties.includes(a) && al.parties.includes(b))
}

export function hasPact(
  pacts: { parties: Nation[]; untilRound: number }[],
  a: Nation, b: Nation, round: number,
): boolean {
  return pacts.some(p =>
    p.untilRound > round && p.parties.includes(a) && p.parties.includes(b))
}
