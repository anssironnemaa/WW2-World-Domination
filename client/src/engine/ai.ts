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

  return {
    nation, round: game.round, difficulty, ipc: player.ipc,
    tech: { ...player.techLevels },
    owned, world, factories, buyable, rivals,
    alliances: game.alliances.map(a => a.parties as string[]),
    faction: FACTIONS[nation] ?? [nation],
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
