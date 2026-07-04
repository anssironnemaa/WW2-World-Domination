// Client-side AI driver: builds a full State Briefing from game state, calls the
// serverless /api/ai-move endpoint, and returns the AI's turn plan (research,
// purchases, espionage, diplomacy, movements). The store applies each part
// through the same validated actions a human uses.
import type { GameState, Nation } from '../data/types'
import { UNIT_TYPES } from '../data/units'
import { factoryCapacityBonus } from '../data/tech'

export type AiMove = { from: string; to: string; unit: string; count: number }
export type AiPurchase = { factory: string; unit: string; count: number }
export type AiSpy = { target: string; points: number }
export type AiResult = {
  moves: AiMove[]
  purchases: AiPurchase[]
  spyOrders: AiSpy[]
  diplomacy: string[]
  research: string | null
  reasoning: string
  source: 'gemini' | 'mock'
}

export type Difficulty = 'easy' | 'normal' | 'hard'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']
const FACTIONS: Record<string, Nation[]> = {
  Germany: ['Germany', 'Italy', 'Japan'], Italy: ['Germany', 'Italy', 'Japan'], Japan: ['Germany', 'Italy', 'Japan'],
  UK: ['UK', 'USA', 'France', 'USSR'], USA: ['UK', 'USA', 'France', 'USSR'], France: ['UK', 'USA', 'France', 'USSR'], USSR: ['UK', 'USA', 'France', 'USSR'],
}

function vcCount(game: GameState, nation: Nation): number {
  let n = 0
  for (const t of Object.values(game.territories)) if (t.isVC && t.owner === nation) n++
  return n
}

function buildBriefing(game: GameState, nation: Nation, difficulty: Difficulty) {
  const player = game.players[nation]
  const owned = Object.values(game.territories)
    .filter(t => t.owner === nation)
    .map(t => {
      const units: Record<string, number> = {}
      for (const [uid, n] of Object.entries(t.units[nation] ?? {})) if (n > 0) units[uid] = n
      return { id: t.id, name: t.nameEN, ipc: t.ipc, isVC: t.isVC, units }
    })
    .filter(t => Object.keys(t.units).length > 0)

  const world = [
    ...Object.values(game.territories).map(t => ({ id: t.id, name: t.nameEN, owner: t.owner, ipc: t.ipc, isVC: t.isVC, type: 'land' as const })),
    ...Object.values(game.seaZones).map(z => ({ id: z.id, name: z.nameEN, owner: 'None', ipc: 0, isVC: false, type: 'sea' as const })),
  ]

  const bonus = factoryCapacityBonus(player.techLevels)
  const factories = Object.values(game.territories)
    .filter(t => t.owner === nation && t.hasFactory)
    .map(t => ({ id: t.id, name: t.nameEN, capacity: Math.max(0, t.ipc - t.factoryDamage + bonus) }))

  const buyable = Object.values(UNIT_TYPES).map(u => ({ id: u.id, name: u.nameFI, cost: u.cost, category: u.category }))

  const rivals = NATIONS.filter(n => n !== nation).map(n => ({
    nation: n, ipc: game.players[n]?.ipc ?? 0, vcs: vcCount(game, n), ai: game.players[n]?.type === 'ai',
  }))

  // Calls to arms this nation has received from its allies (attack these).
  const callsToArms = (game.warRequests ?? [])
    .filter(r => r.ally === nation)
    .map(r => ({ from: r.from, target: r.target }))

  // This nation's current diplomatic ties — for coordinating with allies and
  // respecting non-aggression pacts (until it chooses to betray them).
  const allies = [...new Set(game.alliances
    .filter(a => a.parties.includes(nation))
    .flatMap(a => a.parties)
    .filter(n => n !== nation))]
  const nonAggression = [...new Set((game.pacts ?? [])
    .filter(p => p.untilRound > game.round && p.parties.includes(nation))
    .flatMap(p => p.parties)
    .filter(n => n !== nation))]

  // ── Learning signals: what rivals have declared/done, and who is rising ──
  // Rivals' recently stated aims (their revealed strategies) — learn from them.
  const observedStrategies = (game.strategicNotes ?? [])
    .filter(s => s.nation !== nation && s.round >= game.round - 2)
    .slice(-8)
    .map(s => ({ nation: s.nation, note: s.text }))
  // Latest chronicle of battles, conquests and treaty shifts to react to.
  const recentEvents = (game.chronicle ?? []).slice(-10).map(c => c.text)
  // Momentum: who gained/lost ground since last turn — read the map's balance.
  const hist = game.history ?? []
  const last = hist[hist.length - 1], prev = hist[hist.length - 2]
  const momentum = NATIONS.map(n => ({
    nation: n,
    dTerritories: (last?.perNation[n]?.territories ?? 0) - (prev?.perNation[n]?.territories ?? 0),
    dVcs: (last?.perNation[n]?.vcs ?? 0) - (prev?.perNation[n]?.vcs ?? 0),
  })).filter(m => m.dTerritories !== 0 || m.dVcs !== 0)

  return {
    nation, round: game.round, difficulty, ipc: player.ipc,
    tech: { ...player.techLevels },
    owned, world, factories, buyable, rivals,
    alliances: game.alliances.map(a => a.parties as string[]),
    faction: FACTIONS[nation] ?? [nation],
    callsToArms, allies, nonAggression,
    observedStrategies, recentEvents, momentum,
  }
}

export async function requestAiMove(game: GameState, nation: Nation, difficulty: Difficulty = 'normal'): Promise<AiResult> {
  const briefing = buildBriefing(game, nation, difficulty)
  const res = await fetch('/api/ai-move', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(briefing),
  })
  if (!res.ok) throw new Error(`AI endpoint returned ${res.status}`)
  return res.json() as Promise<AiResult>
}
