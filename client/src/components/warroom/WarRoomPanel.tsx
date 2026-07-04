import { useEffect, useRef, useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { roundToDate } from '../../data/calendar'
import type { Nation } from '../../data/types'

export function WarRoomPanel({ onClose }: { onClose: () => void }) {
  const game = useGameStore(s => s.game)!
  const history = game.history
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [idx, setIdx] = useState(Math.max(0, history.length - 1))
  const [playing, setPlaying] = useState(false)

  useEffect(() => { fetch('/worldmap.svg').then(r => r.text()).then(setSvgContent) }, [])

  // Auto-advance for the "dynamic" playback feel
  useEffect(() => {
    if (!playing) return
    if (idx >= history.length - 1) { setPlaying(false); return }
    const t = setTimeout(() => setIdx(i => Math.min(history.length - 1, i + 1)), 1100)
    return () => clearTimeout(t)
  }, [playing, idx, history.length])

  const snap = history[idx]
  const prev = idx > 0 ? history[idx - 1] : null

  // Colour the map by ownership at the selected round; flag the territories that
  // changed hands since the previous round — the moving front.
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!svg || !snap) return
    svg.querySelectorAll('.front-flag').forEach(el => el.remove())
    const SVGNS = 'http://www.w3.org/2000/svg'

    for (const [tid, owner] of Object.entries(snap.ownership)) {
      const color = NATION_COLORS[owner as Nation] ?? NATION_COLORS['Neutral']
      const changed = prev && prev.ownership[tid] && prev.ownership[tid] !== owner
      svg.querySelectorAll<SVGElement>(`[data-id="${tid}"]`).forEach(el => {
        el.style.fill = color
        el.style.stroke = changed ? '#ffe066' : '#0a0a0a'
        el.style.strokeWidth = changed ? '2' : '0.7'
      })
      if (changed) {
        const anchorEl = svg.querySelector<SVGElement>(`[data-id="${tid}"][data-cx]`)
        if (!anchorEl) continue
        const cx = Number(anchorEl.getAttribute('data-cx')), cy = Number(anchorEl.getAttribute('data-cy'))
        const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'front-flag'); g.style.pointerEvents = 'none'
        const pole = document.createElementNS(SVGNS, 'line')
        pole.setAttribute('x1', String(cx)); pole.setAttribute('y1', String(cy)); pole.setAttribute('x2', String(cx)); pole.setAttribute('y2', String(cy - 11))
        pole.setAttribute('stroke', '#111'); pole.setAttribute('stroke-width', '0.8'); g.appendChild(pole)
        const flag = document.createElementNS(SVGNS, 'polygon')
        flag.setAttribute('points', `${cx},${cy - 11} ${cx + 8},${cy - 9} ${cx},${cy - 7}`)
        flag.setAttribute('fill', NATION_COLORS[owner as Nation] ?? '#fff'); flag.setAttribute('stroke', '#000'); flag.setAttribute('stroke-width', '0.4')
        g.appendChild(flag); svg.appendChild(g)
      }
    }
  }, [snap, prev, svgContent, idx])

  // Conquests this round for the caption
  const shifts = snap && prev
    ? Object.entries(snap.ownership).filter(([tid, o]) => prev.ownership[tid] && prev.ownership[tid] !== o)
        .map(([tid, o]) => ({ name: game.territories[tid]?.nameEN ?? tid, from: prev.ownership[tid], to: o as Nation }))
    : []

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(6,8,12,0.97)', display: 'flex', flexDirection: 'column', color: '#e8e8d8' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #222' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#fff' }}>🎖️ WAR ROOM — FRONT MOVEMENT</div>
          <div style={{ fontSize: 11, color: '#8a9bb0', letterSpacing: 1 }}>{snap ? roundToDate(snap.round).long.toUpperCase() : 'NO DATA'}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#ccc', padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>✕ CLOSE</button>
      </div>

      {history.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667', fontStyle: 'italic' }}>
          No rounds recorded yet — the front map appears after the first round completes.
        </div>
      ) : (
        <>
          {/* Map */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#12202c' }}>
            {svgContent
              ? <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'sepia(0.15) saturate(1.05)' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
              : <div style={{ color: '#667', padding: 40 }}>Loading theatre map…</div>}
          </div>

          {/* Caption of this round's shifts */}
          <div style={{ padding: '8px 22px', minHeight: 20, fontSize: 12, color: '#d8c98a', borderTop: '1px solid #1e1e1e' }}>
            {shifts.length === 0
              ? <span style={{ color: '#667' }}>No territory changed hands this month — the lines held.</span>
              : <span>⚑ {roundToDate(snap.round).long}: {shifts.map((s, i) => (
                  <span key={i}>{i > 0 ? ' · ' : ''}<b style={{ color: NATION_COLORS[s.to] }}>{s.to}</b> took {s.name}</span>
                ))}</span>}
          </div>

          {/* Timeline controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', borderTop: '1px solid #222' }}>
            <button onClick={() => setPlaying(p => !p)} disabled={history.length < 2} style={{
              width: 40, height: 34, borderRadius: 6, border: '1px solid #3a5b7a', background: '#2a3b4a', color: '#cde',
              cursor: history.length < 2 ? 'default' : 'pointer', fontSize: 15,
            }}>{playing ? '⏸' : '▶'}</button>
            <input type="range" min={0} max={history.length - 1} value={idx}
              onChange={e => { setPlaying(false); setIdx(Number(e.target.value)) }}
              style={{ flex: 1, accentColor: '#c8a830' }} />
            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', minWidth: 96, textAlign: 'right' }}>{snap ? roundToDate(snap.round).short : ''}</span>
          </div>
        </>
      )}
    </div>
  )
}
