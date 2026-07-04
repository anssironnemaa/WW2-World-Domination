// Client-side narrative driver: assembles a rich strategic briefing from game
// state (standings, technology, alliances, movements, battles & casualties,
// revealed AI strategies) and asks /api/narrative to render it as prose.
import type { GameState, Nation } from '../data/types'
import { roundToDate } from '../data/calendar'
import { unitName } from '../data/units'

export type NarrativeKind = 'bulletin' | 'battle' | 'documentary' | 'history' | 'chapter'
export type NarrativeResult = { text: string; source: 'gemini' | 'mock' }

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']
const sum = (f: Record<string, number>) => Object.values(f).reduce((s, n) => s + n, 0)

// Current position of every power: cities, treasury, army size, technology.
function standings(game: GameState): string[] {
  return NATIONS.map(n => {
    let vcs = 0, terr = 0
    for (const t of Object.values(game.territories)) if (t.owner === n) { terr++; if (t.isVC) vcs++ }
    let units = 0
    for (const z of [...Object.values(game.territories), ...Object.values(game.seaZones)]) {
      const u = z.units[n]; if (u) units += sum(u)
    }
    const tl = game.players[n]?.techLevels
    const techBits = tl ? Object.entries(tl).filter(([, v]) => v > 0).map(([k, v]) => `${k} T${v}`) : []
    const tech = techBits.length ? `, tech: ${techBits.join('/')}` : ''
    return `${n}: ${vcs} victory cities, ${terr} territories, ${game.players[n]?.ipc ?? 0} IPC, ${units} units${tech}`
  })
}

function treatyLines(game: GameState): string[] {
  return [
    ...game.alliances.map(a => `Alliance: ${a.parties.join(' + ')} (since ${roundToDate(a.sinceRound).short})`),
    ...game.pacts.map(p => `Non-aggression pact: ${p.parties.join(' + ')} (until ${roundToDate(p.untilRound).short})`),
    ...game.mercenaries.map(m => `${m.hirer} hired a ${unitName(m.unit)} from ${m.owner} for ${m.ipc} IPC`),
  ]
}

// Battles this turn, with casualties per side.
export function battleEvents(game: GameState): string[] {
  return game.battleReports.map(b => {
    const aLost = sum(b.attackerInitial) - sum(b.attackerRemaining)
    const dLost = sum(b.defenderInitial) - sum(b.defenderRemaining)
    const outcome = b.winner === 'attacker' ? `${b.attacker} captured ${b.zoneName} from ${b.defender}`
      : b.winner === 'defender' ? `${b.defender} held ${b.zoneName} against ${b.attacker}`
      : `${b.attacker}'s assault on ${b.zoneName} stalled`
    return `${outcome} (${b.attacker} lost ${aLost} units, ${b.defender} lost ${dLost})`
  })
}

// High-level movement intensity per nation (for the bulletin, not raw moves).
function movementSummary(game: GameState): string[] {
  const by: Partial<Record<Nation, number>> = {}
  for (const o of game.revealedArrows) by[o.nation] = (by[o.nation] ?? 0) + 1
  const parts = (Object.entries(by) as [Nation, number][]).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`)
  return parts.length ? [`Troop-movement activity this month: ${parts.join(', ')}`] : []
}

function diplomacyThisRound(game: GameState): string[] {
  return game.diplomacyLog.filter(d => d.round === game.round).map(d => d.text)
}

function leaderLine(game: GameState): string {
  const vc: Partial<Record<Nation, number>> = {}
  for (const t of Object.values(game.territories)) if (t.isVC && t.owner === t.owner && NATIONS.includes(t.owner)) vc[t.owner] = (vc[t.owner] ?? 0) + 1
  const top = (Object.entries(vc) as [Nation, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([n, v]) => `${n} (${v} VCs, ${game.players[n]?.ipc ?? 0} IPC)`)
  return `Front-runners: ${top.join(', ') || 'none yet'}`
}

// AI-stated intentions for a given round window (the revealed strategies).
function strategyEvents(game: GameState, sinceRound = 0): string[] {
  return game.strategicNotes.filter(s => s.round >= sinceRound)
    .map(s => `${s.nation}'s stated aim (${roundToDate(s.round).short}): ${s.text}`)
}

async function post(body: unknown): Promise<NarrativeResult> {
  const res = await fetch('/api/narrative', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Narrative endpoint returned ${res.status}`)
  return res.json() as Promise<NarrativeResult>
}

export function requestBulletin(game: GameState): Promise<NarrativeResult> {
  // A high-level payload — the bulletin should synthesise, not enumerate.
  const events = [
    ...(battleEvents(game).length ? ['This month\'s battles:', ...battleEvents(game)] : ['No major battles this month.']),
    ...(strategyEvents(game, game.round).length ? ['Powers\' stated aims:', ...strategyEvents(game, game.round)] : []),
    ...(diplomacyThisRound(game).length ? ['Diplomacy:', ...diplomacyThisRound(game)] : []),
    ...movementSummary(game),
    leaderLine(game),
  ]
  return post({ kind: 'bulletin', round: game.round, dateLabel: roundToDate(game.round).long, events })
}

export function requestBattleNarration(game: GameState, zoneId: string): Promise<NarrativeResult> {
  const b = game.battleReports.find(r => r.zoneId === zoneId)
  return post({ kind: 'battle', round: game.round, dateLabel: roundToDate(game.round).long, events: b ? b.log : [], focus: b?.zoneName })
}

function fullTimeline(game: GameState): string[] {
  const items = [
    ...game.chronicle.map(c => ({ round: c.round, text: c.text })),
    ...game.diplomacyLog.map(d => ({ round: d.round, text: `Treaty — ${d.text}` })),
    ...game.strategicNotes.map(s => ({ round: s.round, text: `${s.nation}'s aim: ${s.text}` })),
  ].sort((a, b) => a.round - b.round)
  return items.map(e => `${roundToDate(e.round).short}: ${e.text}`)
}

export function requestDocumentary(game: GameState, victor?: Nation): Promise<NarrativeResult> {
  return post({ kind: 'documentary', round: game.round, dateLabel: roundToDate(game.round).long, events: battleEvents(game), focus: victor })
}

export function requestHistory(game: GameState, victor?: Nation): Promise<NarrativeResult> {
  const events = [
    ...fullTimeline(game),
    'FINAL STANDINGS:', ...standings(game),
    victor ? `Victor: ${victor} (${game.victoryType} victory) by ${roundToDate(game.round).long}` : '',
  ].filter(Boolean)
  return post({ kind: 'history', round: game.round, dateLabel: roundToDate(game.round).long, events, focus: victor })
}

export function requestChapter(game: GameState): Promise<NarrativeResult> {
  const events = [
    ...fullTimeline(game),
    'CURRENT STANDINGS:', ...standings(game),
    ...(treatyLines(game).length ? ['ACTIVE TREATIES:', ...treatyLines(game)] : []),
  ]
  return post({ kind: 'chapter', round: game.round, dateLabel: roundToDate(game.round).long, events })
}
