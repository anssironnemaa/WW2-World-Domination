// Shared AI-move logic, used by both the Vercel serverless function (production)
// and the Vite dev middleware (local preview). Files under _lib are NOT exposed
// as endpoints by Vercel.
//
// Contract: a "State Briefing" comes in, an "Action JSON" goes out — exactly the
// AI agent architecture from the rulebook. If no Gemini key is present (or the
// call fails) it falls back to a deterministic heuristic so the loop always works.

export type BriefingTerritory = {
  id: string
  name: string
  ipc: number
  isVC: boolean
  units: Record<string, number>
}

export type BriefingWorldZone = {
  id: string
  name: string
  owner: string
  ipc: number
  isVC: boolean
  type: 'land' | 'sea'
}

export type Briefing = {
  nation: string
  round: number
  difficulty: 'easy' | 'normal' | 'hard'
  ipc: number
  owned: BriefingTerritory[]     // this nation's territories that hold its units
  world: BriefingWorldZone[]     // compact view of every zone (owner/ipc/vc)
}

export type AiMove = { from: string; to: string; unit: string; count: number }
export type AiResult = { moves: AiMove[]; reasoning: string; source: 'gemini' | 'mock' }

const LAND_UNITS = ['infantry', 'artillery', 'mechanized_infantry', 'tank']

// ── Validation: never let a hallucinated/illegal move through ─────────────────
function sanitizeMoves(moves: AiMove[], briefing: Briefing): AiMove[] {
  const ownedById = new Map(briefing.owned.map(t => [t.id, t]))
  const zoneById = new Map(briefing.world.map(z => [z.id, z]))
  const out: AiMove[] = []
  const committed = new Map<string, number>() // `${from}:${unit}` -> count already moved
  for (const m of moves ?? []) {
    const src = ownedById.get(m.from)
    const dst = zoneById.get(m.to)
    if (!src || !dst || m.from === m.to) continue
    const have = src.units[m.unit] ?? 0
    if (have <= 0) continue
    const key = `${m.from}:${m.unit}`
    const already = committed.get(key) ?? 0
    const count = Math.min(Math.max(1, Math.floor(m.count) || 1), have - already)
    if (count <= 0) continue
    // Land units cannot walk onto sea zones (no transport modelling yet)
    if (dst.type === 'sea' && LAND_UNITS.includes(m.unit)) continue
    committed.set(key, already + count)
    out.push({ from: m.from, to: m.to, unit: m.unit, count })
  }
  return out
}

// ── Deterministic fallback AI (also the NPN behaviour: defend, consolidate) ───
function mockMove(briefing: Briefing): AiResult {
  const nation = briefing.nation
  // Reinforce the weakest owned Victory City by pulling infantry from the
  // strongest rear territory. Purely defensive — never attacks.
  const withLand = briefing.owned
    .map(t => ({ t, land: LAND_UNITS.reduce((s, u) => s + (t.units[u] ?? 0), 0) }))
    .filter(x => x.land > 0)

  if (withLand.length < 2) {
    return { moves: [], reasoning: `${nation} holds position (insufficient forces to redeploy).`, source: 'mock' }
  }

  const vcs = withLand.filter(x => x.t.isVC).sort((a, b) => a.land - b.land)
  const target = (vcs[0] ?? [...withLand].sort((a, b) => a.land - b.land)[0]).t
  const source = [...withLand].sort((a, b) => b.land - a.land)[0].t
  if (source.id === target.id) {
    return { moves: [], reasoning: `${nation} concentrates forces at ${target.name}.`, source: 'mock' }
  }

  const infantry = source.units['infantry'] ?? 0
  const count = Math.max(1, Math.min(2, infantry || 1))
  const unit = infantry > 0 ? 'infantry' : LAND_UNITS.find(u => (source.units[u] ?? 0) > 0)!
  const moves = sanitizeMoves([{ from: source.id, to: target.id, unit, count }], briefing)
  return {
    moves,
    reasoning: `${nation} reinforces ${target.name} with ${count}× ${unit} from ${source.name}.`,
    source: 'mock',
  }
}

// ── Gemini path ───────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are an AI general commanding one nation in a WW2 grand-strategy board game (Axis & Allies style). Each round you issue movement orders for your units. You may move a unit from any territory you own into an adjacent-or-reachable zone. Land units (infantry, artillery, mechanized_infantry, tank) can only enter land zones. Play to defend your Victory Cities and press advantages against weaker neighbours. Respond ONLY with JSON matching:
{"moves":[{"from":"<zoneId>","to":"<zoneId>","unit":"<unitId>","count":<int>}],"reasoning":"<one sentence>"}
Use exact zone ids and unit ids from the briefing. Never move more of a unit than you have.`

async function geminiMove(briefing: Briefing, apiKey: string): Promise<AiResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  const difficultyNote = {
    easy: 'You are cautious and sometimes make suboptimal choices.',
    normal: 'You play a historically plausible, competent strategy.',
    hard: 'You play a fully optimized, aggressive-but-sound strategy.',
  }[briefing.difficulty]

  const prompt = `${difficultyNote}\n\nBRIEFING:\n${JSON.stringify(briefing)}`
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', temperature: 0.7 },
  })
  const text = resp.text ?? '{}'
  const parsed = JSON.parse(text) as { moves?: AiMove[]; reasoning?: string }
  return {
    moves: sanitizeMoves(parsed.moves ?? [], briefing),
    reasoning: parsed.reasoning ?? `${briefing.nation} issues orders.`,
    source: 'gemini',
  }
}

export async function runAiMove(briefing: Briefing, apiKey?: string): Promise<AiResult> {
  if (apiKey) {
    try {
      return await geminiMove(briefing, apiKey)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const fallback = mockMove(briefing)
      return { ...fallback, reasoning: `[Gemini unavailable: ${reason}] ${fallback.reasoning}` }
    }
  }
  return mockMove(briefing)
}
