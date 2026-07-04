// Shared AI logic, used by both the Vercel serverless function (production) and
// the Vite dev middleware (local preview). Files under _lib are NOT exposed as
// endpoints by Vercel.
//
// A "State Briefing" comes in; a full turn "Action Plan" goes out — movements,
// purchases, research, espionage and diplomacy. With a Gemini key the plan is
// LLM-authored; without one a deterministic heuristic produces the same shape so
// the game always works.

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

export type BriefingFactory = { id: string; name: string; capacity: number }
export type BriefingUnit = { id: string; name: string; cost: number; category: string }
export type BriefingRival = { nation: string; ipc: number; vcs: number; ai: boolean }

export type Briefing = {
  nation: string
  round: number
  difficulty: 'easy' | 'normal' | 'hard'
  ipc: number
  tech: { land: number; air: number; naval: number; industry: number }
  owned: BriefingTerritory[]     // this nation's territories that hold its units
  world: BriefingWorldZone[]     // compact view of every zone (owner/ipc/vc)
  factories: BriefingFactory[]   // where this nation can build
  buyable: BriefingUnit[]        // units available to purchase
  rivals: BriefingRival[]        // the other powers
  alliances: string[][]          // existing alliances
  faction: string[]              // this nation's historical faction-mates
}

export type AiMove = { from: string; to: string; unit: string; count: number }
export type AiPurchase = { factory: string; unit: string; count: number }
export type AiSpy = { target: string; points: number }
export type AiResult = {
  moves: AiMove[]
  purchases: AiPurchase[]
  spyOrders: AiSpy[]
  diplomacy: string[]           // bracketed commands, e.g. "[ALLIANCE: Germany, Italy]"
  research: string | null       // one branch to research: land|air|naval|industry
  reasoning: string
  source: 'gemini' | 'mock'
}

const LAND_UNITS = ['infantry', 'artillery', 'mechanized_infantry', 'tank']
const TECH_BRANCHES = ['land', 'air', 'naval', 'industry']

// ── Validation ────────────────────────────────────────────────────────────────
function sanitizeMoves(moves: AiMove[], b: Briefing): AiMove[] {
  const ownedById = new Map(b.owned.map(t => [t.id, t]))
  const zoneById = new Map(b.world.map(z => [z.id, z]))
  const out: AiMove[] = []
  const committed = new Map<string, number>()
  for (const m of moves ?? []) {
    const src = ownedById.get(m.from); const dst = zoneById.get(m.to)
    if (!src || !dst || m.from === m.to) continue
    const have = src.units[m.unit] ?? 0
    if (have <= 0) continue
    const key = `${m.from}:${m.unit}`
    const already = committed.get(key) ?? 0
    const count = Math.min(Math.max(1, Math.floor(m.count) || 1), have - already)
    if (count <= 0) continue
    if (dst.type === 'sea' && LAND_UNITS.includes(m.unit)) continue
    committed.set(key, already + count)
    out.push({ from: m.from, to: m.to, unit: m.unit, count })
  }
  return out
}

function sanitizePurchases(purchases: AiPurchase[], b: Briefing): AiPurchase[] {
  const factoryIds = new Set(b.factories.map(f => f.id))
  const capLeft = new Map(b.factories.map(f => [f.id, f.capacity]))
  const cost = new Map(b.buyable.map(u => [u.id, u.cost]))
  let ipc = b.ipc
  const out: AiPurchase[] = []
  for (const p of purchases ?? []) {
    if (!factoryIds.has(p.factory) || !cost.has(p.unit)) continue
    let count = Math.max(0, Math.floor(p.count) || 0)
    while (count > 0 && ipc >= (cost.get(p.unit) ?? 99) && (capLeft.get(p.factory) ?? 0) > 0) {
      ipc -= cost.get(p.unit) ?? 0
      capLeft.set(p.factory, (capLeft.get(p.factory) ?? 0) - 1)
      count--
      const last = out[out.length - 1]
      if (last && last.factory === p.factory && last.unit === p.unit) last.count++
      else out.push({ factory: p.factory, unit: p.unit, count: 1 })
    }
  }
  return out
}

// ── Heuristic plan (also the mock fallback / NPN behaviour) ───────────────────
function heuristicPlan(b: Briefing): AiResult {
  const nation = b.nation
  // Research: cheapest useful branch if wealthy
  let ipc = b.ipc
  let research: string | null = null
  if (ipc >= 30) {
    const branch = TECH_BRANCHES.find(t => (b.tech as Record<string, number>)[t] < 3)
    if (branch) { research = branch; ipc -= 10 }
  }

  // Purchases: buy a mix at the best factory, keep a small reserve
  const purchases: AiPurchase[] = []
  const factory = [...b.factories].sort((a, c) => c.capacity - a.capacity)[0]
  if (factory) {
    let cap = factory.capacity
    const reserve = 6
    const pref = ['infantry', 'tank', 'infantry', 'artillery', 'tank'].filter(u => b.buyable.some(x => x.id === u))
    const costOf = (u: string) => b.buyable.find(x => x.id === u)?.cost ?? 99
    let guard = 0
    const cart: Record<string, number> = {}
    while (cap > 0 && ipc >= reserve + 3 && guard < 300 && pref.length) {
      const u = pref[guard % pref.length]; guard++
      if (ipc - costOf(u) >= reserve) { cart[u] = (cart[u] ?? 0) + 1; ipc -= costOf(u); cap-- }
    }
    for (const [u, c] of Object.entries(cart)) purchases.push({ factory: factory.id, unit: u, count: c })
  }

  // Espionage against the VC leader
  const spyOrders: AiSpy[] = []
  const leader = [...b.rivals].sort((a, c) => c.vcs - a.vcs || c.ipc - a.ipc)[0]
  if (leader && ipc >= 5) { spyOrders.push({ target: leader.nation, points: ipc >= 15 ? 2 : 1 }); ipc -= (ipc >= 15 ? 10 : 5) }

  // Diplomacy: ally with faction-mates that are also AI
  const diplomacy: string[] = []
  const alliesToBe = b.faction.filter(n => n !== nation && b.rivals.find(r => r.nation === n)?.ai)
  const alreadyAllied = b.alliances.some(a => a.includes(nation) && alliesToBe.every(x => a.includes(x)))
  if (alliesToBe.length && !alreadyAllied) diplomacy.push(`[ALLIANCE: ${nation}, ${alliesToBe.join(', ')}]`)

  // Movement: reinforce weakest owned VC from strongest rear
  const withLand = b.owned.map(t => ({ t, land: LAND_UNITS.reduce((s, u) => s + (t.units[u] ?? 0), 0) })).filter(x => x.land > 0)
  let moves: AiMove[] = []
  let moveText = `${nation} holds position`
  if (withLand.length >= 2) {
    const vcs = withLand.filter(x => x.t.isVC).sort((a, c) => a.land - c.land)
    const target = (vcs[0] ?? [...withLand].sort((a, c) => a.land - c.land)[0]).t
    const source = [...withLand].sort((a, c) => c.land - a.land)[0].t
    if (source.id !== target.id) {
      const unit = (source.units['infantry'] ?? 0) > 0 ? 'infantry' : LAND_UNITS.find(u => (source.units[u] ?? 0) > 0)!
      moves = sanitizeMoves([{ from: source.id, to: target.id, unit, count: Math.min(2, source.units[unit] ?? 1) }], b)
      moveText = `${nation} reinforces ${target.name}`
    }
  }

  return {
    moves, purchases, spyOrders, diplomacy, research,
    reasoning: `${moveText}; builds ${purchases.reduce((s, p) => s + p.count, 0)} units${research ? `, researches ${research}` : ''}.`,
    source: 'mock',
  }
}

// ── Gemini path ───────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are the supreme commander of one nation in a WW2 grand-strategy game (Axis & Allies × Diplomacy). Each turn you plan the FULL turn: research, purchases, espionage, diplomacy and unit movements. Play intelligently: defend your Victory Cities, build toward your strengths, exploit weak neighbours, and use alliances and spying to your advantage. Respond ONLY with JSON:
{"research":"land|air|naval|industry or null","purchases":[{"factory":"<factoryId>","unit":"<unitId>","count":<int>}],"spyOrders":[{"target":"<Nation>","points":<int>}],"diplomacy":["[ALLIANCE: A, B]","[NON-AGGRESSION: 2 rounds, PARTIES: A, B]"],"moves":[{"from":"<zoneId>","to":"<zoneId>","unit":"<unitId>","count":<int>}],"reasoning":"<one or two sentences>"}
Rules: spend only IPC you have (research costs 10, spy points cost 5 each); buy only at your factories and within their capacity; use exact ids from the briefing; land units cannot enter sea zones; never move more than you have. Keep purchases realistic. Leave arrays empty when you do nothing.`

async function geminiPlan(b: Briefing, apiKey: string): Promise<AiResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  const difficultyNote = {
    easy: 'You are cautious and sometimes suboptimal.',
    normal: 'You play a competent, historically plausible strategy.',
    hard: 'You play a fully optimized, aggressive-but-sound strategy.',
  }[b.difficulty]
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${difficultyNote}\n\nBRIEFING:\n${JSON.stringify(b)}`,
    config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', temperature: 0.7 },
  })
  const parsed = JSON.parse(resp.text ?? '{}') as Partial<AiResult>
  const research = TECH_BRANCHES.includes(String(parsed.research)) ? String(parsed.research) : null
  return {
    moves: sanitizeMoves(parsed.moves ?? [], b),
    purchases: sanitizePurchases(parsed.purchases ?? [], b),
    spyOrders: (parsed.spyOrders ?? []).filter(s => s && s.target && s.points > 0).map(s => ({ target: s.target, points: Math.min(4, Math.floor(s.points) || 1) })),
    diplomacy: (parsed.diplomacy ?? []).filter(d => typeof d === 'string' && d.includes('[')).slice(0, 3),
    research,
    reasoning: parsed.reasoning ?? `${b.nation} issues its orders.`,
    source: 'gemini',
  }
}

export async function runAiMove(briefing: Briefing, apiKey?: string): Promise<AiResult> {
  if (apiKey) {
    try {
      return await geminiPlan(briefing, apiKey)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const fallback = heuristicPlan(briefing)
      return { ...fallback, reasoning: `[Gemini unavailable: ${reason}] ${fallback.reasoning}` }
    }
  }
  return heuristicPlan(briefing)
}
