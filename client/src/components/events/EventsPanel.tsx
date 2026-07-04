import { useMemo, useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { requestChapter, type NarrativeResult } from '../../engine/narrative'
import { SpeakButton } from '../common/SpeakButton'
import { roundToDate } from '../../data/calendar'
import { unitName } from '../../data/units'
import type { Nation } from '../../data/types'

const KIND_ICON: Record<string, string> = { conquest: '🗺️', battle: '⚔️', power: '📈', treaty: '🤝' }

export function EventsPanel({ onClose }: { onClose: () => void }) {
  const game = useGameStore(s => s.game)!
  const [story, setStory] = useState<NarrativeResult | 'loading' | null>(null)

  // Merge the event chronicle with the diplomacy log into one dated timeline.
  const timeline = useMemo(() => {
    const items = [
      ...game.chronicle.map(c => ({ round: c.round, kind: c.kind as string, text: c.text })),
      ...game.diplomacyLog.map(d => ({ round: d.round, kind: 'treaty', text: d.text })),
    ]
    return items.sort((a, b) => a.round - b.round || (a.kind === 'power' ? 1 : -1))
  }, [game.chronicle, game.diplomacyLog])

  const treaties = [
    ...game.alliances.map(a => ({ icon: '⚔️', label: `Alliance: ${a.parties.join(' & ')}`, sub: `since ${roundToDate(a.sinceRound).short}` })),
    ...game.pacts.map(p => ({ icon: '🕊️', label: `Non-aggression: ${p.parties.join(' & ')}`, sub: `until ${roundToDate(p.untilRound).short}` })),
    ...game.mercenaries.map(m => ({ icon: '💰', label: `${m.hirer} hired ${unitName(m.unit)} from ${m.owner}`, sub: `${m.ipc} IPC · ${roundToDate(m.round).short}` })),
  ]

  const generate = async () => {
    setStory('loading')
    try { setStory(await requestChapter(useGameStore.getState().game!)) }
    catch { setStory({ text: 'The war correspondents have gone silent.', source: 'mock' }) }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(6,8,12,0.96)',
      display: 'flex', flexDirection: 'column', color: '#e8e8d8', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #222' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#fff' }}>📜 CHRONICLE OF THE WAR</div>
          <div style={{ fontSize: 11, color: '#a8b6ca', letterSpacing: 1 }}>{roundToDate(game.round).long.toUpperCase()} · {timeline.length} EVENTS</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#ccc', padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>✕ CLOSE</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 22 }}>
        {/* Left: AI story + timeline */}
        <div>
          {/* AI story so far */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: '#c8a830', letterSpacing: 1, marginBottom: 6 }}>THE STORY SO FAR</div>
            {story && story !== 'loading' ? (
              <div style={{ background: 'rgba(200,168,48,0.06)', border: '1px solid #2a2a2a', borderRadius: 6, padding: 16, fontSize: 14, lineHeight: 1.7, color: '#d8c98a' }}>
                {story.text.split(/\n+/).map((p, i) => <p key={i} style={{ margin: i ? '10px 0 0' : 0 }}>{p}</p>)}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <SpeakButton text={story.text} label="📻 BROADCAST TO THE ROOM" />
                  <span style={{ color: '#8a96aa', fontSize: 10 }}>— {story.source === 'gemini' ? 'war chronicle' : 'field notes'}</span>
                </div>
              </div>
            ) : (
              <button onClick={generate} disabled={story === 'loading'} style={{
                width: '100%', padding: '12px 0', borderRadius: 6, border: '1px solid #c8a830',
                background: story === 'loading' ? '#2a2820' : 'rgba(200,168,48,0.1)', color: '#c8a830',
                fontSize: 12, fontWeight: 'bold', letterSpacing: 1, cursor: story === 'loading' ? 'default' : 'pointer',
              }}>
                {story === 'loading' ? 'WRITING THE CHRONICLE…' : '✍️ GENERATE THE STORY SO FAR'}
              </button>
            )}
            {story && story !== 'loading' && (
              <button onClick={generate} style={{ marginTop: 6, background: 'none', border: 'none', color: '#8a96aa', fontSize: 10, cursor: 'pointer' }}>↻ regenerate</button>
            )}
          </div>

          {/* Timeline */}
          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, marginBottom: 8 }}>TIMELINE</div>
          {timeline.length === 0 ? (
            <div style={{ color: '#8a96aa', fontSize: 12, fontStyle: 'italic' }}>No events recorded yet.</div>
          ) : (
            <div style={{ borderLeft: '2px solid #2a2a2a', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timeline.map((e, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -21, top: 2, fontSize: 11 }}>{KIND_ICON[e.kind] ?? '•'}</span>
                  <div style={{ fontSize: 10, color: '#a8b6ca' }}>{roundToDate(e.round).long}</div>
                  <div style={{ fontSize: 12, color: '#ddd' }}>{highlightNations(e.text)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: active treaties */}
        <div>
          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, marginBottom: 8 }}>ACTIVE TREATIES & DEALS</div>
          {treaties.length === 0 ? (
            <div style={{ color: '#8a96aa', fontSize: 12, fontStyle: 'italic' }}>No treaties in force. The powers act alone.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {treaties.map((t, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: '#ddd' }}>{t.icon} {t.label}</div>
                  <div style={{ fontSize: 10, color: '#8a96aa', marginTop: 2 }}>{t.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Colour nation names inline for quick scanning.
function highlightNations(text: string) {
  const nations: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']
  const parts: (string | React.ReactElement)[] = [text]
  nations.forEach(n => {
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]
      if (typeof seg !== 'string' || !seg.includes(n)) continue
      const split = seg.split(n)
      const rebuilt: (string | React.ReactElement)[] = []
      split.forEach((s, j) => {
        if (j > 0) rebuilt.push(<b key={`${n}-${i}-${j}`} style={{ color: NATION_COLORS[n] }}>{n}</b>)
        rebuilt.push(s)
      })
      parts.splice(i, 1, ...rebuilt)
      i += rebuilt.length - 1
    }
  })
  return parts
}
