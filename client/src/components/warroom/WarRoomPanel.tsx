import { useEffect, useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ZoomControls } from '../common/ZoomControls'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { roundToDate } from '../../data/calendar'
import { ADJACENCY, ZONE_KIND } from '../../data/adjacency'
import type { Nation } from '../../data/types'

const isRealNation = (n: string) => n !== 'Neutral' && n !== 'None'

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>{swatch}</span>
      <span>{label}</span>
    </div>
  )
}

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

  // Colour the map by ownership at the selected round; overlay that round's
  // movement arrows, battle sites, troop totals, and flag the moving front.
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!svg || !snap) return
    svg.querySelectorAll('.wr-overlay').forEach(el => el.remove())
    const SVGNS = 'http://www.w3.org/2000/svg'
    const anchor = (id: string): [number, number] | null => {
      const el = svg.querySelector<SVGElement>(`[data-id="${id}"][data-cx]`)
      return el ? [Number(el.getAttribute('data-cx')), Number(el.getAttribute('data-cy'))] : null
    }
    const add = (el: SVGElement) => { el.classList.add('wr-overlay'); (el as SVGElement).style.pointerEvents = 'none'; svg.appendChild(el) }

    // Ownership recolor + front flags
    for (const [tid, owner] of Object.entries(snap.ownership)) {
      const color = NATION_COLORS[owner as Nation] ?? NATION_COLORS['Neutral']
      const changed = prev && prev.ownership[tid] && prev.ownership[tid] !== owner
      svg.querySelectorAll<SVGElement>(`[data-id="${tid}"]`).forEach(el => {
        el.style.fill = color; el.style.stroke = changed ? '#ffe066' : '#0a0a0a'; el.style.strokeWidth = changed ? '2' : '0.7'
      })
      if (changed) {
        const a = anchor(tid); if (!a) continue
        const g = document.createElementNS(SVGNS, 'g')
        const pole = document.createElementNS(SVGNS, 'line')
        pole.setAttribute('x1', String(a[0])); pole.setAttribute('y1', String(a[1])); pole.setAttribute('x2', String(a[0])); pole.setAttribute('y2', String(a[1] - 11))
        pole.setAttribute('stroke', '#111'); pole.setAttribute('stroke-width', '0.8'); g.appendChild(pole)
        const flag = document.createElementNS(SVGNS, 'polygon')
        flag.setAttribute('points', `${a[0]},${a[1] - 11} ${a[0] + 8},${a[1] - 9} ${a[0]},${a[1] - 7}`)
        flag.setAttribute('fill', NATION_COLORS[owner as Nation] ?? '#fff'); flag.setAttribute('stroke', '#000'); flag.setAttribute('stroke-width', '0.4')
        g.appendChild(flag); add(g)
      }
    }

    // ── Battle line / front: link adjacent land held by opposing powers ──
    const owns = (id: string) => snap.ownership[id]
    for (const [tid, owner] of Object.entries(snap.ownership)) {
      if (!isRealNation(owner) || ZONE_KIND[tid] !== 'land') continue
      const a = anchor(tid); if (!a) continue
      for (const nb of ADJACENCY[tid] ?? []) {
        if (tid >= nb || ZONE_KIND[nb] !== 'land') continue   // draw each border once
        const other = owns(nb)
        if (!other || !isRealNation(other) || other === owner) continue
        const b = anchor(nb); if (!b) continue
        // midpoint tick marks perpendicular to the link = the contested front
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
        const seg = document.createElementNS(SVGNS, 'line')
        seg.setAttribute('x1', String(a[0])); seg.setAttribute('y1', String(a[1]))
        seg.setAttribute('x2', String(b[0])); seg.setAttribute('y2', String(b[1]))
        seg.setAttribute('stroke', '#ff5a3c'); seg.setAttribute('stroke-width', '1.3')
        seg.setAttribute('stroke-dasharray', '2 2.5'); seg.setAttribute('opacity', '0.55')
        add(seg)
        const dot = document.createElementNS(SVGNS, 'circle')
        dot.setAttribute('cx', String(mx)); dot.setAttribute('cy', String(my)); dot.setAttribute('r', '1.6')
        dot.setAttribute('fill', '#ff7a4c'); dot.setAttribute('stroke', '#3a0d05'); dot.setAttribute('stroke-width', '0.4')
        add(dot)
      }
    }

    // Troop total badges per zone
    for (const [zid, per] of Object.entries(snap.forces)) {
      const a = anchor(zid); if (!a) continue
      const entries = Object.entries(per) as [Nation, number][]
      entries.forEach(([nat, tot], i) => {
        const y = a[1] + (i - (entries.length - 1) / 2) * 8
        const g = document.createElementNS(SVGNS, 'g')
        const rect = document.createElementNS(SVGNS, 'rect')
        rect.setAttribute('x', String(a[0] - 6)); rect.setAttribute('y', String(y - 3.5)); rect.setAttribute('width', '12'); rect.setAttribute('height', '7'); rect.setAttribute('rx', '1.5')
        rect.setAttribute('fill', NATION_COLORS[nat] ?? '#a2a2a2'); rect.setAttribute('stroke', '#000'); rect.setAttribute('stroke-width', '0.4')
        g.appendChild(rect)
        const text = document.createElementNS(SVGNS, 'text')
        text.setAttribute('x', String(a[0])); text.setAttribute('y', String(y + 1.6)); text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size', '5'); text.setAttribute('font-weight', 'bold'); text.setAttribute('fill', '#fff'); text.setAttribute('font-family', 'sans-serif')
        text.textContent = String(tot); g.appendChild(text); add(g)
      })
    }

    // Battle marks this round
    for (const b of snap.battles) {
      const a = anchor(b.zoneId); if (!a) continue
      const g = document.createElementNS(SVGNS, 'g')
      const outer = document.createElementNS(SVGNS, 'circle')
      outer.setAttribute('cx', String(a[0] + 7)); outer.setAttribute('cy', String(a[1] - 7)); outer.setAttribute('r', '4'); outer.setAttribute('fill', '#c0392b'); outer.setAttribute('stroke', '#000'); outer.setAttribute('stroke-width', '0.5'); g.appendChild(outer)
      const inner = document.createElementNS(SVGNS, 'circle')
      inner.setAttribute('cx', String(a[0] + 7)); inner.setAttribute('cy', String(a[1] - 7.4)); inner.setAttribute('r', '1.8'); inner.setAttribute('fill', '#ffcc33'); g.appendChild(inner)
      add(g)
    }

    // Movement / attack vectors this round — bold arrows from source to target
    snap.arrows.forEach((o, idx2) => {
      const s = anchor(o.from), d = anchor(o.to); if (!s || !d) return
      const [sx, sy] = s, [dx, dy] = d
      const len = Math.hypot(dx - sx, dy - sy) || 1
      const nx = -(dy - sy) / len, ny = (dx - sx) / len
      const bow = Math.min(40, len * 0.18) * (idx2 % 2 === 0 ? 1 : -1)
      const mx = (sx + dx) / 2 + nx * bow, my = (sy + dy) / 2 + ny * bow
      // stop the curve short of the target so the arrowhead sits cleanly
      const t = Math.max(0, 1 - 6 / len)
      const ex = mx + (dx - mx) * t, ey = my + (dy - my) * t
      const color = NATION_COLORS[o.nation] ?? '#fff'
      const ang = Math.atan2(dy - my, dx - mx), ah = 9
      const g = document.createElementNS(SVGNS, 'g')
      const dStr = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`
      const halo = document.createElementNS(SVGNS, 'path'); halo.setAttribute('d', dStr); halo.setAttribute('fill', 'none'); halo.setAttribute('stroke', '#000'); halo.setAttribute('stroke-width', '5.5'); halo.setAttribute('stroke-linecap', 'round'); halo.setAttribute('opacity', '0.55'); g.appendChild(halo)
      const path = document.createElementNS(SVGNS, 'path'); path.setAttribute('d', dStr); path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-dasharray', '6 3'); g.appendChild(path)
      const head = document.createElementNS(SVGNS, 'polygon'); head.setAttribute('points', `${dx},${dy} ${dx - ah * Math.cos(ang - 0.42)},${dy - ah * Math.sin(ang - 0.42)} ${dx - ah * Math.cos(ang + 0.42)},${dy - ah * Math.sin(ang + 0.42)}`); head.setAttribute('fill', color); head.setAttribute('stroke', '#000'); head.setAttribute('stroke-width', '0.5'); g.appendChild(head)
      add(g)
    })
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
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#fff' }}>🎖️ WAR ROOM — THEATRE MAP</div>
          <div style={{ fontSize: 11, color: '#a8b6ca', letterSpacing: 1 }}>{snap ? roundToDate(snap.round).long.toUpperCase() : 'NO DATA'}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#ccc', padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>✕ CLOSE</button>
      </div>

      {history.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a96aa', fontStyle: 'italic' }}>
          No turns recorded yet — the front map appears after the first turn completes.
        </div>
      ) : (
        <>
          {/* Map — zoomable / pannable so you can study the front up close */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#12202c' }}>
            {svgContent
              ? <TransformWrapper initialScale={1} minScale={0.6} maxScale={7} wheel={{ step: 0.12 }} panning={{ velocityDisabled: true }} doubleClick={{ mode: 'reset' }}>
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                        <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'sepia(0.15) saturate(1.05)' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
                      </TransformComponent>
                      <ZoomControls zoomIn={() => zoomIn()} zoomOut={() => zoomOut()} reset={() => resetTransform()} size="lg" />
                    </>
                  )}
                </TransformWrapper>
              : <div style={{ color: '#8a96aa', padding: 40 }}>Loading theatre map…</div>}
            <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, color: '#8a96aa', pointerEvents: 'none' }}>pinch / scroll to zoom · drag to pan</div>

            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 10, left: 10, background: 'rgba(6,10,16,0.82)', border: '1px solid #2a3444',
              borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: '#cdd6e2',
            }}>
              <LegendRow swatch={<span style={{ display: 'inline-block', width: 20, height: 3, background: '#c8a830', borderRadius: 2 }} />} label="Attack vector / troop movement" />
              <LegendRow swatch={<span style={{ display: 'inline-block', width: 20, height: 0, borderTop: '2px dashed #ff5a3c' }} />} label="Battle line (contested front)" />
              <LegendRow swatch={<span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: '#c0392b', border: '1px solid #ffcc33' }} />} label="Battle fought this month" />
              <LegendRow swatch={<span style={{ fontSize: 12 }}>⚑</span>} label="Territory that changed hands" />
            </div>
          </div>

          {/* Caption of this round's shifts */}
          <div style={{ padding: '8px 22px', minHeight: 20, fontSize: 12, color: '#d8c98a', borderTop: '1px solid #1e1e1e' }}>
            {shifts.length === 0
              ? <span style={{ color: '#8a96aa' }}>No territory changed hands this month — the lines held.</span>
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
