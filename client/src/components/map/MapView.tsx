import { useEffect, useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { TerritoryPanel } from './TerritoryPanel'
import { Sidebar } from '../ui/Sidebar'
import { TopBar } from '../ui/TopBar'
import { PurchaseButton } from '../phases/PurchasePhase'
import { PhasePanel } from '../phases/PhasePanel'
import { GameOverOverlay } from '../phases/GameOverOverlay'
import { StatsPanel } from '../stats/StatsPanel'
import { EventsPanel } from '../events/EventsPanel'
import { WarRoomPanel } from '../warroom/WarRoomPanel'
import { UNIT_TYPES } from '../../data/units'
import type { Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

const UNIT_SHORT: Record<string, string> = {
  infantry: 'INF', tank: 'TNK', artillery: 'ART', mechanized_infantry: 'MEC',
  fighter: 'FTR', bomber: 'BMB', submarine: 'SUB', destroyer: 'DD', cruiser: 'CA',
  carrier: 'CV', transport: 'TP', battleship: 'BB', partisan: 'PAR',
}


export function MapView() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [showWarRoom, setShowWarRoom] = useState(false)
  const game = useGameStore(s => s.game)
  const selectedZoneId = useGameStore(s => s.selectedZoneId)
  const selectZone = useGameStore(s => s.selectZone)
  const handleZoneClick = useGameStore(s => s.handleZoneClick)
  const orderingNation = useGameStore(s => s.orderingNation)
  const pendingMove = useGameStore(s => s.pendingMove)
  const cancelMove = useGameStore(s => s.cancelMove)

  useEffect(() => {
    fetch('/worldmap.svg')
      .then(r => r.text())
      .then(text => setSvgContent(text))
  }, [])

  // Wire click events after SVG content renders
  useEffect(() => {
    if (!svgContent || !containerRef.current) return
    const svg = containerRef.current.querySelector('svg')
    if (!svg) return
    svgRef.current = svg as SVGSVGElement

    const handler = (e: MouseEvent) => {
      const target = (e.target as SVGElement).closest<SVGElement>('[data-id]')
      handleZoneClick(target ? target.getAttribute('data-id') : null)
    }
    svg.addEventListener('click', handler)
    return () => svg.removeEventListener('click', handler)
  }, [svgContent, handleZoneClick])

  // Apply ownership colors and selection highlight
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!game || !svg) return

    Object.values(game.territories).forEach(t => {
      const color = NATION_COLORS[t.owner] ?? NATION_COLORS['Neutral']
      // A territory may be split across multiple paths sharing the same data-id.
      svg.querySelectorAll<SVGElement>(`[data-id="${t.id}"]`).forEach(el => { el.style.fill = color })
    })

    svg.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
    if (selectedZoneId) {
      svg.querySelector(`#${selectedZoneId}`)?.classList.add('selected')
    }
  }, [game, selectedZoneId, svgContent])

  // Unit markers — rendered from precomputed data-cx/data-cy anchors baked into
  // the SVG, so they're deterministic (no getBBox / layout-timing races).
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!game || !svg) return

    const SVGNS = 'http://www.w3.org/2000/svg'
    const CHIP_W = 21, CHIP_H = 7.5, GAP = 1

    svg.querySelectorAll('.unit-marker').forEach(el => el.remove())

    const allZones = { ...game.territories, ...game.seaZones }
    Object.entries(allZones).forEach(([zoneId, zone]) => {
      const anchorEl = svg.querySelector<SVGElement>(`[data-id="${zoneId}"][data-cx]`)
      if (!anchorEl) return
      const cx = Number(anchorEl.getAttribute('data-cx'))
      const cy = Number(anchorEl.getAttribute('data-cy'))
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return

      // Flatten to one chip per (nation, unit type)
      const chips: { nation: Nation; unit: string; count: number }[] = []
      for (const [nation, units] of Object.entries(zone.units)) {
        for (const [unit, count] of Object.entries(units ?? {})) {
          if (count > 0) chips.push({ nation: nation as Nation, unit, count })
        }
      }
      if (chips.length === 0) return
      chips.sort((a, b) =>
        a.nation.localeCompare(b.nation) ||
        (UNIT_TYPES[a.unit]?.cost ?? 0) - (UNIT_TYPES[b.unit]?.cost ?? 0))

      const startY = cy - (chips.length * (CHIP_H + GAP)) / 2

      const g = document.createElementNS(SVGNS, 'g')
      g.setAttribute('class', 'unit-marker')
      g.style.pointerEvents = 'none'

      chips.forEach((chip, i) => {
        const y = startY + i * (CHIP_H + GAP)
        const color = NATION_COLORS[chip.nation] ?? '#888'
        const code = UNIT_SHORT[chip.unit] ?? chip.unit.slice(0, 3).toUpperCase()

        const rect = document.createElementNS(SVGNS, 'rect')
        rect.setAttribute('x', String(cx - CHIP_W / 2))
        rect.setAttribute('y', String(y))
        rect.setAttribute('width', String(CHIP_W))
        rect.setAttribute('height', String(CHIP_H))
        rect.setAttribute('rx', '1.5')
        rect.setAttribute('fill', color)
        rect.setAttribute('stroke', '#000')
        rect.setAttribute('stroke-width', '0.4')
        rect.setAttribute('opacity', '0.95')
        g.appendChild(rect)

        const text = document.createElementNS(SVGNS, 'text')
        text.setAttribute('x', String(cx))
        text.setAttribute('y', String(y + CHIP_H - 2))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size', '5')
        text.setAttribute('font-weight', 'bold')
        text.setAttribute('fill', '#fff')
        text.setAttribute('font-family', 'sans-serif')
        text.textContent = `${chip.count} ${code}`
        g.appendChild(text)
      })

      svg.appendChild(g)
    })
  }, [game, svgContent])

  // Movement arrows + battle-site flames — drawn from the persisted revealed
  // movements/battles, so they stay on the map from reveal through the next
  // round's planning until a new reveal replaces them.
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg')
    if (!game || !svg) return
    svg.querySelectorAll('.move-arrow').forEach(el => el.remove())
    svg.querySelectorAll('.battle-mark').forEach(el => el.remove())

    const SVGNS = 'http://www.w3.org/2000/svg'
    const anchor = (zoneId: string): [number, number] | null => {
      const el = svg.querySelector<SVGElement>(`[data-id="${zoneId}"][data-cx]`)
      if (!el) return null
      return [Number(el.getAttribute('data-cx')), Number(el.getAttribute('data-cy'))]
    }

    // Battle-site markers (small red/yellow flame) — drawn first so arrows sit on top
    game.revealedBattles.forEach(b => {
      const a = anchor(b.zoneId)
      if (!a) return
      const [bx, by] = a
      const g = document.createElementNS(SVGNS, 'g')
      g.setAttribute('class', 'battle-mark')
      g.style.pointerEvents = 'none'
      const outer = document.createElementNS(SVGNS, 'circle')
      outer.setAttribute('cx', String(bx)); outer.setAttribute('cy', String(by))
      outer.setAttribute('r', '4.2'); outer.setAttribute('fill', '#c0392b')
      outer.setAttribute('stroke', '#000'); outer.setAttribute('stroke-width', '0.5')
      g.appendChild(outer)
      const inner = document.createElementNS(SVGNS, 'circle')
      inner.setAttribute('cx', String(bx)); inner.setAttribute('cy', String(by - 0.4))
      inner.setAttribute('r', '2'); inner.setAttribute('fill', '#ffcc33')
      g.appendChild(inner)
      svg.appendChild(g)
    })

    const orders = game.revealedArrows
    orders.forEach((o, idx) => {
      const s = anchor(o.from), d = anchor(o.to)
      if (!s || !d) return
      const [sx, sy] = s, [dx, dy] = d
      const dxv = dx - sx, dyv = dy - sy
      const len = Math.hypot(dxv, dyv) || 1
      // Perpendicular bow for an arc; small alternating offset to separate overlapping arrows
      const nx = -dyv / len, ny = dxv / len
      const bow = Math.min(40, len * 0.18) * (idx % 2 === 0 ? 1 : -1)
      const mx = (sx + dx) / 2 + nx * bow, my = (sy + dy) / 2 + ny * bow
      // Stop a little short of the destination so the arrowhead sits at the edge
      const t = Math.max(0, 1 - 7 / len)
      const ex = mx + (dx - mx) * t, ey = my + (dy - my) * t
      const color = NATION_COLORS[o.nation] ?? '#fff'

      const g = document.createElementNS(SVGNS, 'g')
      g.setAttribute('class', 'move-arrow')
      g.style.pointerEvents = 'none'

      const dStr = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`
      // Dark halo behind for contrast against any terrain colour
      const halo = document.createElementNS(SVGNS, 'path')
      halo.setAttribute('d', dStr)
      halo.setAttribute('fill', 'none')
      halo.setAttribute('stroke', '#000')
      halo.setAttribute('stroke-width', '4.5')
      halo.setAttribute('stroke-linecap', 'round')
      halo.setAttribute('opacity', '0.5')
      g.appendChild(halo)

      const path = document.createElementNS(SVGNS, 'path')
      path.setAttribute('d', dStr)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '2.6')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('opacity', '0.95')
      path.setAttribute('stroke-dasharray', '5 3')
      g.appendChild(path)

      // Arrowhead at destination, oriented along the final segment
      const ang = Math.atan2(dy - my, dx - mx)
      const ah = 7
      const p1 = `${dx},${dy}`
      const p2 = `${dx - ah * Math.cos(ang - 0.4)},${dy - ah * Math.sin(ang - 0.4)}`
      const p3 = `${dx - ah * Math.cos(ang + 0.4)},${dy - ah * Math.sin(ang + 0.4)}`
      const head = document.createElementNS(SVGNS, 'polygon')
      head.setAttribute('points', `${p1} ${p2} ${p3}`)
      head.setAttribute('fill', color)
      head.setAttribute('stroke', '#000')
      head.setAttribute('stroke-width', '0.4')
      g.appendChild(head)

      // Small count label at the arc apex
      const label = document.createElementNS(SVGNS, 'text')
      label.setAttribute('x', String(mx))
      label.setAttribute('y', String(my - 2))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('font-size', '6')
      label.setAttribute('font-weight', 'bold')
      label.setAttribute('fill', '#fff')
      label.setAttribute('stroke', '#000')
      label.setAttribute('stroke-width', '0.3')
      label.setAttribute('font-family', 'sans-serif')
      label.textContent = `${o.count} ${UNIT_SHORT[o.unit] ?? o.unit.slice(0, 3).toUpperCase()}`
      g.appendChild(label)

      svg.appendChild(g)
    })
  }, [game, svgContent])

  const selectedTerritory = selectedZoneId && game
    ? game.territories[selectedZoneId] ?? null
    : null

  const selectedSeaZone = selectedZoneId && game
    ? game.seaZones[selectedZoneId] ?? null
    : null

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <TransformWrapper
            initialScale={1}
            minScale={0.3}
            maxScale={8}
            wheel={{ step: 0.1 }}
            panning={{ velocityDisabled: true }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', background: '#1a4a6a' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              {svgContent ? (
                <div
                  ref={containerRef}
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'stretch' }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <div style={{ color: '#888', padding: 40, fontSize: 14, letterSpacing: 2 }}>LOADING MAP...</div>
              )}
            </TransformComponent>
          </TransformWrapper>

          {/* Territory panel — bottom right */}
          {(selectedTerritory || selectedSeaZone) && (
            <div style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 10,
            }}>
              <TerritoryPanel
                territory={selectedTerritory}
                seaZone={selectedSeaZone}
                onClose={() => selectZone(null)}
              />
            </div>
          )}

          {/* Legend — bottom left */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(10,10,10,0.85)',
            border: '1px solid #2a2a2a',
            borderRadius: 4,
            padding: '8px 12px',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            maxWidth: 300,
          }}>
            {NATIONS.map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#888' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: NATION_COLORS[n] }} />
                {n === 'USSR' ? 'SOVIET UNION' : n.toUpperCase()}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#888' }}>
              <span style={{ color: '#ffe066', fontSize: 9 }}>★</span> VC
            </div>
          </div>

          {/* Purchase row */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20, display: 'flex', gap: 6 }}>
            <button
              onClick={() => setShowStats(true)}
              style={{
                padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
                background: '#2a3b4a', border: '1px solid #3a5b7a', color: '#cde',
                cursor: 'pointer', letterSpacing: 1,
              }}
            >📊 STATS</button>
            <button
              onClick={() => setShowEvents(true)}
              style={{
                padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
                background: '#3a2f4a', border: '1px solid #5a3f7a', color: '#dce',
                cursor: 'pointer', letterSpacing: 1,
              }}
            >📜 CHRONICLE</button>
            <button
              onClick={() => setShowWarRoom(true)}
              style={{
                padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
                background: '#3a3320', border: '1px solid #6a5a20', color: '#e8d9a0',
                cursor: 'pointer', letterSpacing: 1,
              }}
            >🎖️ WAR ROOM</button>
            <PurchaseButton compact />
          </div>

          {/* Overlays */}
          {showStats && <StatsPanel onClose={() => setShowStats(false)} />}
          {showEvents && <EventsPanel onClose={() => setShowEvents(false)} />}
          {showWarRoom && <WarRoomPanel onClose={() => setShowWarRoom(false)} />}

          {/* Phase panel — top left */}
          <PhasePanel />

          {/* Turn / targeting banner — top center */}
          {game?.phase === 'orders' && orderingNation && (
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 25,
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 20,
              background: pendingMove ? 'rgba(200,168,48,0.95)' : 'rgba(10,10,10,0.9)',
              border: `1px solid ${pendingMove ? '#ffe066' : NATION_COLORS[orderingNation]}`,
              color: pendingMove ? '#0d0d0d' : '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5,
              boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}>
              {pendingMove ? (
                <>
                  <span>🎯 CLICK A DESTINATION ZONE</span>
                  <button onClick={cancelMove} style={{
                    background: '#0d0d0d', color: '#ffe066', border: 'none', borderRadius: 12,
                    fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold',
                  }}>CANCEL</button>
                </>
              ) : (
                <>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: NATION_COLORS[orderingNation], display: 'inline-block' }} />
                  <span>YOUR TURN — {orderingNation.toUpperCase()} · click your zones to move units</span>
                </>
              )}
            </div>
          )}

          {/* Victory screen */}
          <GameOverOverlay />
        </div>
      </div>
    </div>
  )
}
