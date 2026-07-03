import { useEffect, useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { requestDocumentary, type NarrativeResult } from '../../engine/narrative'

// Full-screen victory screen. Auto-generates the closing documentary narration
// (Gemini, with template fallback) the moment a winner is declared.
export function GameOverOverlay() {
  const game = useGameStore(s => s.game)
  const winner = game?.winner ?? null
  const [doc, setDoc] = useState<NarrativeResult | 'loading' | null>(null)

  useEffect(() => {
    if (!winner || !game) return
    let cancelled = false
    setDoc('loading')
    requestDocumentary(game, winner)
      .then(r => { if (!cancelled) setDoc(r) })
      .catch(() => { if (!cancelled) setDoc({ text: 'The archives fell silent before the final word was written.', source: 'mock' }) })
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
        width: 560, maxWidth: '90%', textAlign: 'center', padding: 40,
        border: `1px solid ${color}66`, borderTop: `4px solid ${color}`, borderRadius: 6,
        background: 'linear-gradient(180deg, rgba(20,22,28,0.9), rgba(10,12,16,0.95))',
        boxShadow: `0 0 60px ${color}33`,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#888' }}>ROUND {game.round} · THE WAR IS DECIDED</div>
        <div style={{ fontSize: 30, fontWeight: 'bold', color, letterSpacing: 2, margin: '14px 0 6px' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 2 }}>
          {game.victoryType === 'alliance'
            ? `9+ Victory Cities held by the alliance`
            : `7 Victory Cities under one flag`}
        </div>

        <div style={{
          minHeight: 90, padding: 18, borderRadius: 4, background: 'rgba(200,168,48,0.06)',
          border: '1px solid #2a2a2a', color: '#d8c98a', fontStyle: 'italic', fontSize: 14, lineHeight: 1.7,
        }}>
          {doc === 'loading' || doc === null
            ? <span style={{ color: '#666' }}>The correspondents compose the final dispatch…</span>
            : <>“{doc.text}”<div style={{ fontStyle: 'normal', color: '#666', fontSize: 10, marginTop: 8 }}>
                — {doc.source === 'gemini' ? 'closing narration' : 'archival note'}</div></>}
        </div>

        <button onClick={() => window.location.reload()} style={{
          marginTop: 26, padding: '10px 28px', borderRadius: 4, border: 'none',
          background: color, color: '#0d0d0d', fontWeight: 'bold', fontSize: 12, letterSpacing: 1, cursor: 'pointer',
        }}>▶ NEW WAR</button>
      </div>
    </div>
  )
}
