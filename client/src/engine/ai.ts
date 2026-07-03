// Client-side AI driver: builds a State Briefing from game state, calls the
// serverless /api/ai-move endpoint, and returns the resulting moves. The store
// applies them via submitOrder/lockOrders — the AI plays through the same rules
// and validation as a human.
import type { GameState, Nation } from '../data/types'

export type AiMove = { from: string; to: string; unit: string; count: number }
export type AiResult = { moves: AiMove[]; reasoning: string; source: 'gemini' | 'mock' }

export type Difficulty = 'easy' | 'normal' | 'hard'

function buildBriefing(game: GameState, nation: Nation, difficulty: Difficulty) {
  const owned = Object.values(game.territories)
    .filter(t => t.owner === nation)
    .map(t => {
      const units: Record<string, number> = {}
      for (const [uid, n] of Object.entries(t.units[nation] ?? {})) if (n > 0) units[uid] = n
      return { id: t.id, name: t.nameEN, ipc: t.ipc, isVC: t.isVC, units }
    })
    .filter(t => Object.keys(t.units).length > 0)

  // Compact world view: every zone's owner/value so the AI can reason about targets.
  const world = [
    ...Object.values(game.territories).map(t => ({
      id: t.id, name: t.nameEN, owner: t.owner, ipc: t.ipc, isVC: t.isVC, type: 'land' as const,
    })),
    ...Object.values(game.seaZones).map(z => ({
      id: z.id, name: z.nameEN, owner: 'None', ipc: 0, isVC: false, type: 'sea' as const,
    })),
  ]

  return { nation, round: game.round, difficulty, ipc: game.players[nation]?.ipc ?? 0, owned, world }
}

export async function requestAiMove(
  game: GameState, nation: Nation, difficulty: Difficulty = 'normal',
): Promise<AiResult> {
  const briefing = buildBriefing(game, nation, difficulty)
  const res = await fetch('/api/ai-move', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(briefing),
  })
  if (!res.ok) throw new Error(`AI endpoint returned ${res.status}`)
  return res.json() as Promise<AiResult>
}
