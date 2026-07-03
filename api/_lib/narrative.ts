// Shared LLM-narrative logic (Phase 4). Turns factual game events into prose:
//  - bulletin:    a world-news dispatch summarising a round
//  - battle:      a dramatized retelling of one battle
//  - documentary: closing narration when the war ends
// Gemini-backed with a deterministic template fallback, so it always produces
// something even without a key. Same pattern as api/_lib/aiMove.ts.

export type NarrativeKind = 'bulletin' | 'battle' | 'documentary' | 'history'

export type NarrativeRequest = {
  kind: NarrativeKind
  round: number
  events: string[]     // pre-summarised factual lines from game state
  focus?: string       // optional subject, e.g. a battle's zone name or the victor
}

export type NarrativeResult = { text: string; source: 'gemini' | 'mock' }

const SYSTEM: Record<NarrativeKind, string> = {
  bulletin: `You are a WW2 radio war correspondent broadcasting a world news bulletin. Given the round's events, write a vivid but concise dispatch of 2-4 sentences. Period tone, no bullet points, no headings. Do not invent outcomes not present in the events.`,
  battle: `You are a WW2 war correspondent. Dramatize the given battle in 2-3 sentences — tense and evocative, but faithful to who won and what was lost. No headings.`,
  documentary: `You are the narrator of a somber WW2 documentary. Write a 3-5 sentence closing reflection on how the war ended, given the events. Measured, historical, elegiac. No headings.`,
  history: `You are a historian writing the definitive account of this war for posterity. You are given a chronological list of the war's events (battles, conquests, shifting balances of power, treaties made and broken) and the eventual victor. Write a vivid, flowing narrative history of 3-5 short paragraphs that tells the STORY of the war: how it opened, how power shifted between the belligerents, which alliances formed and which collapsed, the pivotal turning points, and how the winner ultimately rose to dominate the world. Be engaging and dramatic but faithful to the events given — do not invent battles or outcomes not listed. Reference specific nations, cities, and rounds. No headings, no bullet points; write it as prose a reader would enjoy.`,
}

// ── Deterministic fallback ────────────────────────────────────────────────────
function mockNarrative(req: NarrativeRequest): NarrativeResult {
  const evts = req.events.filter(Boolean)
  if (evts.length === 0) {
    const empty: Record<NarrativeKind, string> = {
      bulletin: `Round ${req.round}: an uneasy quiet settles over the fronts. No major engagements were reported.`,
      battle: `The engagement at ${req.focus ?? 'the front'} ended without decisive result.`,
      documentary: `And so the guns fell silent, the map redrawn by ambition and attrition alike.`,
      history: `The war passed with few recorded engagements${req.focus ? `, yet ${req.focus} emerged supreme` : ''}. What manoeuvres decided it are lost to the archives.`,
    }
    return { text: empty[req.kind], source: 'mock' }
  }
  const joined = evts.join('; ')
  const text: Record<NarrativeKind, string> = {
    bulletin: `Round ${req.round} dispatch — across the theatres of war: ${joined}. Commanders on every side weigh their next move as the balance of power shifts.`,
    battle: `At ${req.focus ?? 'the front'}, the fighting was fierce. ${joined}.`,
    documentary: `When at last the war concluded${req.focus ? ` with ${req.focus} ascendant` : ''}, the ledger of these years read plainly: ${joined}. History would remember the cost.`,
    history: `The history of the war, in brief: ${joined}.${req.focus ? ` Through these turns of fortune, ${req.focus} rose to dominate the world.` : ''}`,
  }
  return { text: text[req.kind], source: 'mock' }
}

// ── Gemini path ───────────────────────────────────────────────────────────────
async function geminiNarrative(req: NarrativeRequest, apiKey: string): Promise<NarrativeResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  const prompt = [
    `Round: ${req.round}`,
    req.focus ? `Subject: ${req.focus}` : '',
    'Events:',
    ...req.events.map(e => `- ${e}`),
  ].filter(Boolean).join('\n')

  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { systemInstruction: SYSTEM[req.kind], temperature: 0.9 },
  })
  const text = (resp.text ?? '').trim()
  if (!text) return mockNarrative(req)
  return { text, source: 'gemini' }
}

export async function runNarrative(req: NarrativeRequest, apiKey?: string): Promise<NarrativeResult> {
  if (apiKey) {
    try {
      return await geminiNarrative(req, apiKey)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      const fallback = mockNarrative(req)
      return { text: `[Gemini unavailable: ${reason}] ${fallback.text}`, source: 'mock' }
    }
  }
  return mockNarrative(req)
}
