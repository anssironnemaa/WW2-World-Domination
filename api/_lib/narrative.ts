// Shared LLM-narrative logic (Phase 4). Turns factual game events into prose:
//  - bulletin:    a world-news dispatch summarising a round
//  - battle:      a dramatized retelling of one battle
//  - documentary: closing narration when the war ends
// Gemini-backed with a deterministic template fallback, so it always produces
// something even without a key. Same pattern as api/_lib/aiMove.ts.

export type NarrativeKind = 'bulletin' | 'battle' | 'documentary' | 'history' | 'chapter'

export type NarrativeRequest = {
  kind: NarrativeKind
  round: number
  dateLabel?: string   // "September 1939" — preferred over round in prose
  events: string[]     // pre-summarised factual lines from game state
  focus?: string       // optional subject, e.g. a battle's zone name or the victor
}

export type NarrativeResult = { text: string; source: 'gemini' | 'mock' }

const SYSTEM: Record<NarrativeKind, string> = {
  bulletin: `You are a WW2 radio war correspondent delivering the month's news bulletin in the voice of a seasoned front-line journalist. You are given the month's raw developments (battles and casualties, the powers' stated aims, diplomacy, movement activity, front-runners). SYNTHESISE them into a flowing, strategic dispatch of 3-4 sentences — the way a war correspondent or historian would characterise the month, NOT a list. Do NOT enumerate individual unit movements, tallies, or mechanical actions. Instead capture the big picture: where the momentum lies, the decisive battle or gambit of the month, how the balance of power is shifting, and any diplomatic manoeuvring — then close with a brief, evocative line of what to watch for next. Open by naming the month and year. Period newsreel tone, English, no bullet points, headings, numbers-as-lists, or unit jargon. Faithful to the events but written as engaging prose.`,
  battle: `You are a WW2 war correspondent. Dramatize the given battle in 2-3 sentences — tense and evocative, faithful to who won, the forces engaged and what was lost. English, no headings.`,
  documentary: `You are the narrator of a somber WW2 documentary. Write a 3-5 sentence closing reflection on how the war ended and why, given the events. Measured, historical, elegiac. Refer to time by month and year, never round numbers. English, no headings.`,
  history: `You are a historian writing the definitive account of this war. You are given a dated chronicle (battles with casualties, conquests, shifting power, the powers' stated strategic aims, and every treaty, alliance and betrayal) plus the final standings and the victor. Write a vivid, ANALYTICAL narrative history of 3-5 short paragraphs that tells the STORY of the war AND interprets it: how it opened, how each power's strategy EVOLVED over time as its leaders learned from one another, how the web of alliances formed, shifted and shattered, and how technology, industry and troop strength decided the balance. As a historian reconstructing causes after the fact, explain WHY the pivotal realignments happened — the threat, ambition or opportunity behind each alliance, betrayal and change of course — and treat sudden reversals as the dramatic turning points they were. Identify the costliest battles and how the winner rose to dominate, assessing the leadership of the key powers with a historian's praise and criticism. Be engaging and dramatic but faithful to the events. Refer to time by month and year ("by the spring of 1940"), never round numbers. Reference specific nations, cities and casualties. English prose, no headings or bullet points; write it like a chapter from a great history book.`,
  chapter: `You are a war historian and analyst narrating THE STORY SO FAR of a war still being fought. From the dated chronicle (battles with casualties, movements, the powers' stated aims, treaties, and every shift of alliance or betrayal) and the current standings (victory cities, treasury, army size, technology), write 3-4 flowing, ANALYTICAL paragraphs: recount how the war has unfolded and, crucially, trace how the powers' STRATEGIES AND ALLIANCES HAVE EVOLVED — who allied with whom and why, which pacts held and which were torn up, and what each leader appears to have LEARNED from watching its rivals. Like a historian reconstructing motives after the fact, explain WHY these realignments happened: what threat or opportunity on the map drove a power to switch sides, betray a partner, or gang up on the leader. Interpret each major power's strategy and leadership with praise and criticism, and show how alliances, technology and troop strength are tilting the balance. End with a paragraph of informed speculation about likely next moves, brewing betrayals, and who holds the advantage. Be vivid like a history book, faithful to the events, English, no headings or bullet points. Refer to time by month and year, never round numbers.`,
}

// ── Deterministic fallback ────────────────────────────────────────────────────
function mockNarrative(req: NarrativeRequest): NarrativeResult {
  const evts = req.events.filter(Boolean)
  if (evts.length === 0) {
    const when = req.dateLabel ?? `round ${req.round}`
    const empty: Record<NarrativeKind, string> = {
      bulletin: `${when}: an uneasy quiet settles over the fronts. No major engagements were reported.`,
      battle: `The engagement at ${req.focus ?? 'the front'} ended without decisive result.`,
      documentary: `And so the guns fell silent, the map redrawn by ambition and attrition alike.`,
      history: `The war passed with few recorded engagements${req.focus ? `, yet ${req.focus} emerged supreme` : ''}. What manoeuvres decided it are lost to the archives.`,
      chapter: `As of ${when}, the fronts remain quiet and the powers watchful. The war's decisive chapters are yet to be written.`,
    }
    return { text: empty[req.kind], source: 'mock' }
  }
  const joined = evts.join('; ')
  const when = req.dateLabel ?? `round ${req.round}`
  const text: Record<NarrativeKind, string> = {
    bulletin: `${when} dispatch — across the theatres of war: ${joined}. Commanders on every side weigh their next move as the balance of power shifts.`,
    battle: `At ${req.focus ?? 'the front'}, the fighting was fierce. ${joined}.`,
    documentary: `When at last the war concluded${req.focus ? ` with ${req.focus} ascendant` : ''}, the ledger of these years read plainly: ${joined}. History would remember the cost.`,
    history: `The history of the war, in brief: ${joined}.${req.focus ? ` Through these turns of fortune, ${req.focus} rose to dominate the world.` : ''}`,
    chapter: `The story so far (as of ${when}): ${joined}. The war hangs in the balance.`,
  }
  return { text: text[req.kind], source: 'mock' }
}

// ── Gemini path ───────────────────────────────────────────────────────────────
async function geminiNarrative(req: NarrativeRequest, apiKey: string): Promise<NarrativeResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  const prompt = [
    `Date: ${req.dateLabel ?? `round ${req.round}`}`,
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
