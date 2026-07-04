// Movement engine — pathfinding over the zone adjacency graph, with the rules
// for unit range, land units crossing sea (transports) and aircraft landing at
// sea (carriers).
import { ADJACENCY, ZONE_KIND } from '../data/adjacency'
import { UNIT_TYPES } from '../data/units'
import type { GameState, Nation } from '../data/types'

const LAND_CATS = ['infantry', 'armor']
export const isLandUnit = (uid: string) => LAND_CATS.includes(UNIT_TYPES[uid]?.category ?? '')
export const isAirUnit = (uid: string) => (UNIT_TYPES[uid]?.category ?? '') === 'air'
export const isSeaUnit = (uid: string) => (UNIT_TYPES[uid]?.category ?? '') === 'navy'

// Breadth-first shortest path over zones the predicate allows (endpoints always allowed).
function bfs(from: string, to: string, allow: (zoneId: string) => boolean): string[] | null {
  if (from === to) return [from]
  const prev = new Map<string, string>()
  const seen = new Set<string>([from])
  let frontier = [from]
  while (frontier.length) {
    const next: string[] = []
    for (const z of frontier) {
      for (const n of ADJACENCY[z] ?? []) {
        if (seen.has(n)) continue
        if (n !== to && !allow(n)) continue
        seen.add(n); prev.set(n, z)
        if (n === to) {
          const path = [n]; let cur = n
          while (cur !== from) { cur = prev.get(cur)!; path.unshift(cur) }
          return path
        }
        next.push(n)
      }
    }
    frontier = next
  }
  return null
}

export type MovePlan = {
  ok: boolean
  reason?: string          // why it's blocked
  path: string[]           // full route (incl. endpoints), [] if none
  distance: number         // edges
  range: number            // this unit's per-turn move
  multiTurn: boolean       // distance exceeds range → standing order
  needsTransport: boolean  // land unit crossing sea
  needsCarrier: boolean    // aircraft ending at sea
  transportZone?: string   // sea zone used for the crossing
}

// Count a nation's spare transport/carrier capacity in a zone (each transport
// carries 2, each carrier carries 2), minus what pending orders already use.
function spareCapacity(game: GameState, nation: Nation, zoneId: string, kind: 'transport' | 'carrier'): number {
  const zone = game.seaZones[zoneId]
  if (!zone) return 0
  const ships = zone.units[nation]?.[kind] ?? 0
  let used = 0
  for (const o of game.orders[nation] ?? []) if (o.transportZone === zoneId) used += o.count
  return ships * 2 - used
}

export function evaluateMove(game: GameState, nation: Nation, from: string, to: string, unit: string): MovePlan {
  const range = UNIT_TYPES[unit]?.move ?? 1
  const base: MovePlan = { ok: false, path: [], distance: 0, range, multiTurn: false, needsTransport: false, needsCarrier: false }
  if (from === to) return { ...base, reason: 'Source and destination are the same' }
  if (!ADJACENCY[from] || !ADJACENCY[to]) return { ...base, reason: 'Unknown zone' }

  // ── Aircraft: fly over anything; must land on a carrier if ending at sea ────
  if (isAirUnit(unit)) {
    const path = bfs(from, to, () => true)
    if (!path) return { ...base, reason: 'No route' }
    const distance = path.length - 1
    const needsCarrier = ZONE_KIND[to] === 'sea'
    if (needsCarrier && unit === 'bomber') return { ...base, path, distance, reason: 'Bombers cannot land at sea' }
    if (needsCarrier && spareCapacity(game, nation, to, 'carrier') <= 0)
      return { ...base, path, distance, needsCarrier: true, reason: `No carrier capacity in ${game.seaZones[to]?.nameEN ?? to}` }
    return { ...base, ok: true, path, distance, multiTurn: distance > range, needsCarrier }
  }

  // ── Naval: sea zones only ───────────────────────────────────────────────────
  if (isSeaUnit(unit)) {
    if (ZONE_KIND[to] !== 'sea') return { ...base, reason: 'Ships stay at sea' }
    const path = bfs(from, to, z => ZONE_KIND[z] === 'sea')
    if (!path) return { ...base, reason: 'No sea route' }
    const distance = path.length - 1
    return { ...base, ok: true, path, distance, multiTurn: distance > range }
  }

  // ── Land: prefer a land route; otherwise a transport must bridge the sea ────
  if (ZONE_KIND[to] === 'sea') return { ...base, reason: 'Land units cannot occupy the open sea' }
  const landPath = bfs(from, to, z => ZONE_KIND[z] === 'land')
  if (landPath) {
    const distance = landPath.length - 1
    return { ...base, ok: true, path: landPath, distance, multiTurn: distance > range }
  }
  // Need a sea crossing: find a sea zone adjacent to both from and to with a transport
  const fromSeas = (ADJACENCY[from] ?? []).filter(z => ZONE_KIND[z] === 'sea')
  const toSeas = new Set((ADJACENCY[to] ?? []).filter(z => ZONE_KIND[z] === 'sea'))
  const bridges = fromSeas.filter(z => toSeas.has(z))
  if (bridges.length === 0) return { ...base, reason: 'No land route and no single sea crossing — move via nearer zones' }
  const usable = bridges.find(z => spareCapacity(game, nation, z, 'transport') > 0)
  if (!usable) {
    const names = bridges.map(z => game.seaZones[z]?.nameEN ?? z).join(' or ')
    return { ...base, needsTransport: true, reason: `Needs a Transport in ${names} — move one there first (each carries 2)` }
  }
  return { ...base, ok: true, path: [from, usable, to], distance: 2, needsTransport: true, transportZone: usable, multiTurn: false }
}
