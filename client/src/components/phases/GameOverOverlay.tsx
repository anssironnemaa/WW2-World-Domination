import { useEffect, useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { requestHistory, type NarrativeResult } from '../../engine/narrative'
import { roundToDate } from '../../data/calendar'

// Full-screen victory screen. Auto-generates the full AI-written war history
// (Gemini, with template fallback) the moment a winner is declared.
export function GameOverOverlay() {
  const game = useGameStore(s => s.game)
  const winner = game?.winner ?? null
  const [doc, setDoc] = useState<NarrativeResult | 'loading' | null>(null)

  useEffect(() => {
    if (!winner || !game) return
    let cancelled = false
    setDoc('loading')
    requestHistory(game, winner)
      .then(r => { if (!cancelled) setDoc(r) })
      .catch(() => { if (!cancelled) setDoc({ text: 'The archives fell silent before the history could be written.', source: 'mock' }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner])

  if (!game || !winner) return null

  const color = NATION_COLORS[winner]
  const parties = game.winningParties
  const title = game.victoryType === 'alliance'
    ? `${parties.join(' & ')} — ALLIED VICTORY`
    : `${winner} — TOTAL VICTORY`

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'rgba(5,7,10,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 680, maxWidth: '92%', maxHeight: '90%', overflowY: 'auto', textAlign: 'center', padding: 40,
        border: `1px solid ${color}66`, borderTop: `4px solid ${color}`, borderRadius: 6,
        background: 'linear-gradient(180deg, rgba(20,22,28,0.9), rgba(10,12,16,0.95))',
        boxShadow: `0 0 60px ${color}33`,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#888' }}>{roundToDate(game.round).long.toUpperCase()} · THE WAR IS DECIDED</div>
        <div style={{ fontSize: 30, fontWeight: 'bold', color, letterSpacing: 2, margin: '14px 0 6px' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 2 }}>
          {game.victoryType === 'alliance'
            ? `9+ Victory Cities held by the alliance`
            : `7 Victory Cities under one flag`}
        </div>

        <div style={{ fontSize: 10, letterSpacing: 3, color: '#888', marginBottom: 8 }}>THE HISTORY OF THE WAR</div>
        <div style={{
          minHeight: 90, padding: 20, borderRadius: 4, background: 'rgba(200,168,48,0.06)',
          border: '1px solid #2a2a2a', color: '#d8c98a', fontSize: 14, lineHeight: 1.75, textAlign: 'left',
        }}>
          {doc === 'loading' || doc === null
            ? <span style={{ color: '#666', fontStyle: 'italic' }}>The historians assemble the record of these years…</span>
            : <>{doc.text.split(/\n+/).map((para, i) => (
                <p key={i} style={{ margin: i === 0 ? '0 0 10px' : '10px 0' }}>{para}</p>
              ))}
              <div style={{ color: '#666', fontSize: 10, marginTop: 10, textAlign: 'right' }}>
                — {doc.source === 'gemini' ? 'official war history' : 'archival summary'}</div></>}
        </div>

        <button onClick={() => window.location.reload()} style={{
          marginTop: 26, padding: '10px 28px', borderRadius: 4, border: 'none',
          background: color, color: '#0d0d0d', fontWeight: 'bold', fontSize: 12, letterSpacing: 1, cursor: 'pointer',
        }}>▶ NEW WAR</button>
      </div>
    </div>
  )
}
