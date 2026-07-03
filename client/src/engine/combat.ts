// Combat resolution engine — dice mechanics per WW2_World_Dominance_Taulukot.xlsx
// Hit if d6 roll <= attack (attacker) / defend (defender).
// Artillery: each gun raises one infantry's attack from 1 to 2.
// Submarine first strike unless the enemy fleet contains a destroyer.
// Transports die automatically to the first hit if unescorted, and never roll.
import { UNIT_TYPES } from '../data/units'
import type { Nation } from '../data/types'

export type Force = Record<string, number> // unitId -> count

export type BattleRound = {
  attackerHits: number
  defenderHits: number
  attackerLosses: Force
  defenderLosses: Force
}

export type BattleResult = {
  zoneId: string
  zoneName: string
  attacker: Nation
  defender: Nation
  rounds: BattleRound[]
  attackerRemaining: Force
  defenderRemaining: Force
  winner: 'attacker' | 'defender' | 'draw'
  log: string[]
}

const d6 = () => Math.floor(Math.random() * 6) + 1

function totalUnits(f: Force): number {
  return Object.values(f).reduce((s, n) => s + n, 0)
}

function combatUnits(f: Force): number {
  return Object.entries(f).reduce((s, [uid, n]) => s + (uid === 'transport' ? 0 : n), 0)
}

// Roll for one side. `side` picks attack vs defend values.
function rollHits(force: Force, side: 'attack' | 'defend', log: string[], label: string): number {
  let hits = 0
  // Artillery support: each artillery boosts one infantry from 1 to 2 (attack only)
  const artillery = force['artillery'] ?? 0
  let boostedInf = side === 'attack' ? Math.min(artillery, force['infantry'] ?? 0) : 0

  for (const [uid, count] of Object.entries(force)) {
    const u = UNIT_TYPES[uid]
    if (!u || count <= 0 || uid === 'transport') continue
    for (let i = 0; i < count; i++) {
      let target = side === 'attack' ? u.attack : u.defend
      if (uid === 'infantry' && side === 'attack' && boostedInf > 0) {
        target = 2
        boostedInf--
      }
      if (target <= 0) continue
      const roll = d6()
      if (roll <= target) hits++
    }
  }
  if (hits > 0) log.push(`${label}: ${hits} hit${hits === 1 ? '' : 's'}`)
  return hits
}

// Remove `hits` casualties, cheapest combat units first; transports last (free kills).
function applyCasualties(force: Force, hits: number): Force {
  const losses: Force = {}
  let remaining = hits
  const order = Object.keys(force)
    .filter(uid => force[uid] > 0)
    .sort((a, b) => {
      // transports are removed first as free kills per rules (die to first hit unescorted),
      // but only when no combat units remain to absorb; here: cheapest combat first, transports last
      const ta = a === 'transport' ? 999 : (UNIT_TYPES[a]?.cost ?? 99)
      const tb = b === 'transport' ? 999 : (UNIT_TYPES[b]?.cost ?? 99)
      return ta - tb
    })
  for (const uid of order) {
    if (remaining <= 0) break
    const take = Math.min(force[uid], remaining)
    force[uid] -= take
    if (force[uid] <= 0) delete force[uid]
    losses[uid] = take
    remaining -= take
  }
  // Unescorted transports die automatically once combat units are gone
  if (combatUnits(force) === 0 && (force['transport'] ?? 0) > 0 && hits > 0) {
    losses['transport'] = (losses['transport'] ?? 0) + force['transport']
    delete force['transport']
  }
  return losses
}

export function resolveBattle(
  zoneId: string,
  zoneName: string,
  attacker: Nation,
  attackerForce: Force,
  defender: Nation,
  defenderForce: Force,
  maxRounds = 10,
): BattleResult {
  const atk: Force = { ...attackerForce }
  const def: Force = { ...defenderForce }
  const rounds: BattleRound[] = []
  const log: string[] = [`Battle for ${zoneName}: ${attacker} attacks ${defender}`]

  // Submarine first strike (before round 1) if the other side has no destroyer
  const subStrike = (force: Force, enemy: Force, label: string) => {
    const subs = force['submarine'] ?? 0
    if (subs === 0 || (enemy['destroyer'] ?? 0) > 0) return
    let hits = 0
    for (let i = 0; i < subs; i++) if (d6() <= UNIT_TYPES['submarine'].attack) hits++
    if (hits > 0) {
      log.push(`${label} submarine first strike: ${hits} hit${hits === 1 ? '' : 's'}`)
      applyCasualties(enemy, hits)
    }
  }
  subStrike(atk, def, attacker)
  subStrike(def, atk, defender)

  for (let r = 1; r <= maxRounds; r++) {
    if (combatUnits(atk) === 0 || totalUnits(def) === 0) break
    log.push(`— Round ${r} —`)
    const aHits = rollHits(atk, 'attack', log, attacker)
    const dHits = rollHits(def, 'defend', log, defender)
    const defenderLosses = applyCasualties(def, aHits)
    const attackerLosses = applyCasualties(atk, dHits)
    rounds.push({ attackerHits: aHits, defenderHits: dHits, attackerLosses, defenderLosses })
    for (const [uid, n] of Object.entries(defenderLosses)) log.push(`  ${defender} loses ${n}× ${UNIT_TYPES[uid]?.nameFI ?? uid}`)
    for (const [uid, n] of Object.entries(attackerLosses)) log.push(`  ${attacker} loses ${n}× ${UNIT_TYPES[uid]?.nameFI ?? uid}`)
  }

  const winner: BattleResult['winner'] =
    totalUnits(def) === 0 && totalUnits(atk) > 0 ? 'attacker'
    : totalUnits(atk) === 0 ? 'defender'
    : 'draw'
  log.push(
    winner === 'attacker' ? `${attacker} captures ${zoneName}` :
    winner === 'defender' ? `${defender} holds ${zoneName}` :
    `Stalemate in ${zoneName} — attacker withdraws`
  )

  return { zoneId, zoneName, attacker, defender, rounds, attackerRemaining: atk, defenderRemaining: def, winner, log }
}
