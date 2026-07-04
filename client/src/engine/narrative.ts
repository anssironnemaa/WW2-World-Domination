// Client-side narrative driver: turns the round's mechanical results into a
// factual event list and asks /api/narrative to render it as prose.
import type { GameState, Nation } from '../data/types'
import { roundToDate } from '../data/calendar'

export type NarrativeKind = 'bulletin' | 'battle' | 'documentary' | 'history' | 'chapter'
export type NarrativeResult = { text: string; source: 'gemini' | 'mock' }

// Factual one-liners describing every battle this round.
export function battleEvents(game: GameState): string[] {
  return game.battleReports.map(b => {
    if (b.winner === 'attacker') return `${b.attacker} captured ${b.zoneName} from ${b.defender}`
    if (b.winner === 'defender') return `${b.defender} repelled ${b.attacker}'s assault on ${b.zoneName}`
    return `${b.attacker}'s attack on ${b.zoneName} ended in stalemate`
  })
}

export function incomeEvents(game: GameState): string[] {
  return (Object.entries(game.incomeReport) as [Nation, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n, v]) => `${n} drew ${v} IPC in production`)
}

async function post(body: unknown): Promise<NarrativeResult> {
  const res = await fetch('/api/narrative', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Narrative endpoint returned ${res.status}`)
  return res.json() as Promise<NarrativeResult>
}

export function requestBulletin(game: GameState): Promise<NarrativeResult> {
  const events = [...battleEvents(game), ...incomeEvents(game)]
  return post({ kind: 'bulletin', round: game.round, dateLabel: roundToDate(game.round).long, events })
}

export function requestBattleNarration(game: GameState, zoneId: string): Promise<NarrativeResult> {
  const b = game.battleReports.find(r => r.zoneId === zoneId)
  const events = b ? b.log : []
  return post({ kind: 'battle', round: game.round, dateLabel: roundToDate(game.round).long, events, focus: b?.zoneName })
}

export function requestDocumentary(game: GameState, victor?: Nation): Promise<NarrativeResult> {
  const events = battleEvents(game)
  return post({ kind: 'documentary', round: game.round, dateLabel: roundToDate(game.round).long, events, focus: victor })
}

// Full-game war history: merge the chronicle (battles, conquests, power shifts)
// with the diplomacy log (treaties), in chronological order, plus final standings.
export function requestHistory(game: GameState, victor?: Nation): Promise<NarrativeResult> {
  const timeline = [
    ...game.chronicle.map(c => ({ round: c.round, text: c.text })),
    ...game.diplomacyLog.map(d => ({ round: d.round, text: `Treaty — ${d.text}` })),
  ].sort((a, b) => a.round - b.round)

  const vcTally: Partial<Record<Nation, number>> = {}
  for (const t of Object.values(game.territories)) {
    if (t.isVC && t.owner !== 'Neutral' && t.owner !== 'None') vcTally[t.owner] = (vcTally[t.owner] ?? 0) + 1
  }
  const standings = (Object.entries(vcTally) as [Nation, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([n, v]) => `${n}: ${v} VCs, ${game.players[n]?.ipc ?? 0} IPC`)

  const events = [
    ...timeline.map(e => `${roundToDate(e.round).long}: ${e.text}`),
    `Final standings — ${standings.join(' | ')}`,
    victor ? `Victor: ${victor} (${game.victoryType} victory) by ${roundToDate(game.round).long}` : '',
  ].filter(Boolean)

  return post({ kind: 'history', round: game.round, dateLabel: roundToDate(game.round).long, events, focus: victor })
}

// "The story so far" — a running chronicle narrative for the events page (mid-war).
export function requestChapter(game: GameState): Promise<NarrativeResult> {
  const timeline = [
    ...game.chronicle.map(c => ({ round: c.round, text: c.text })),
    ...game.diplomacyLog.map(d => ({ round: d.round, text: `Treaty — ${d.text}` })),
  ].sort((a, b) => a.round - b.round)
  const events = timeline.map(e => `${roundToDate(e.round).long}: ${e.text}`)
  return post({ kind: 'chapter', round: game.round, dateLabel: roundToDate(game.round).long, events })
}
