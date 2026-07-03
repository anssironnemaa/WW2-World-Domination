// Espionage resolution — runs at the reveal phase, after all orders are locked.
//  Spy points: 5 IPC each, allocated against a target nation.
//  If attacker points > defender shield → success → reveals the target's move orders.
//  Defender shield = spy points the target allocated defensively (self-target) + encryption(+1).
//  On failure, a d6 decides how loud the attempt was.
//  Code-breaking: a nation with the 20-IPC upgrade rolls d6 each round; 1-3 reveals a
//  random enemy's orders — UNLESS that enemy has encryption.
import type { Nation, SpyOrder, SpyReport, MoveOrder, Player } from '../data/types'

const d6 = () => Math.floor(Math.random() * 6) + 1

export function resolveEspionage(
  round: number,
  spyOrders: SpyOrder[],
  orders: Partial<Record<Nation, MoveOrder[]>>,
  players: Record<Nation, Player>,
): SpyReport[] {
  const reports: SpyReport[] = []

  // Defensive shield per nation = points they spent targeting themselves + encryption
  const shield: Partial<Record<Nation, number>> = {}
  for (const so of spyOrders) {
    if (so.spy === so.target) shield[so.target] = (shield[so.target] ?? 0) + so.points
  }

  // Offensive spy attempts (spy != target)
  for (const so of spyOrders) {
    if (so.spy === so.target) continue
    const enc = players[so.target]?.encryption ? 1 : 0
    const defense = (shield[so.target] ?? 0) + enc
    if (so.points > defense) {
      reports.push({
        round, spy: so.spy, target: so.target, success: true,
        detail: `${so.spy} infiltrated ${so.target} (${so.points} vs shield ${defense}) — orders revealed`,
        revealedOrders: orders[so.target] ?? [],
      })
    } else {
      const roll = d6()
      const detail =
        roll <= 3 ? `${so.spy}'s operation against ${so.target} went silent (no trace)`
        : roll <= 5 ? `${so.target} detected a spying attempt`
        : `Double agent! ${so.target} feeds ${so.spy} false intel next round`
      reports.push({ round, spy: so.spy, target: so.target, success: false, detail })
    }
  }

  // Code-breaking: passive per-round intercept
  const nations = Object.keys(players) as Nation[]
  for (const spy of nations) {
    if (!players[spy]?.codeBreaking) continue
    const roll = d6()
    if (roll > 3) continue
    // Pick a random enemy without encryption that issued orders
    const targets = nations.filter(n =>
      n !== spy && !players[n]?.encryption && (orders[n]?.length ?? 0) > 0)
    if (targets.length === 0) continue
    const target = targets[Math.floor(Math.random() * targets.length)]
    // Avoid a duplicate report if a manual spy already cracked the same target
    if (reports.some(r => r.spy === spy && r.target === target && r.success)) continue
    reports.push({
      round, spy, target, success: true,
      detail: `${spy} code-breakers intercepted ${target}'s transmissions (d6=${roll})`,
      revealedOrders: orders[target] ?? [],
    })
  }

  return reports
}
