import { useEffect, useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { TerritoryPanel } from './TerritoryPanel'
import { Sidebar } from '../ui/Sidebar'
import { TopBar } from '../ui/TopBar'
import { PurchaseButton } from '../phases/PurchasePhase'
import { PhasePanel } from '../phases/PhasePanel'
import { GameOverOverlay } from '../phases/GameOverOverlay'
import type { Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']


export function MapView() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const game = useGameStore(s => s.game)
  const selectedZoneId = useGameStore(s => s.selectedZoneId)
  const selectZone = useGameStore(s => s.selectZone)

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
      if (!target) { selectZone(null); return }
      selectZone(target.getAttribute('data-id'))
    }
    svg.addEventListener('click', handler)
    return () => svg.removeEventListener('click', handler)
  }, [svgContent, selectZone])

  // Apply ownership colors and selection highlight
  useEffect(() => {
    const svg = svgRef.current
    if (!game || !svg) return

    Object.values(game.territories).forEach(t => {
      const el = svg.querySelector<SVGElement>(`#${t.id}`)
      if (el) el.style.fill = NATION_COLORS[t.owner] ?? NATION_COLORS['Neutral']
    })

    svg.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
    if (selectedZoneId) {
      svg.querySelector(`#${selectedZoneId}`)?.classList.add('selected')
    }
  }, [game, selectedZoneId, svgContent])

  // Unit markers — deferred so SVG layout is complete before calling getBBox
  useEffect(() => {
    const svg = svgRef.current
    if (!game || !svg) return

    const render = () => {
      svg.querySelectorAll('.unit-marker').forEach(el => el.remove())

      const allZones = { ...game.territories, ...game.seaZones }
      Object.entries(allZones).forEach(([zoneId, zone]) => {
        const el = svg.querySelector<SVGGraphicsElement>(`#${zoneId}`)
        if (!el) return

        let total = 0
        const nationCounts: Partial<Record<Nation, number>> = {}
        Object.entries(zone.units).forEach(([nation, units]) => {
          const count = Object.values(units).reduce((s, c) => s + c, 0)
          if (count > 0) { total += count; nationCounts[nation as Nation] = count }
        })
        if (total === 0) return

        const bbox = el.getBBox?.()
        if (!bbox || bbox.width === 0) return

        const cx = bbox.x + bbox.width / 2
        const cy = bbox.y + bbox.height * 0.62

        const primaryNation = (Object.keys(nationCounts)[0] as Nation) ?? 'Neutral'
        const color = NATION_COLORS[primaryNation] ?? '#888'

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.setAttribute('class', 'unit-marker')
        g.style.pointerEvents = 'none'

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', String(cx))
        circle.setAttribute('cy', String(cy))
        circle.setAttribute('r', '8')
        circle.setAttribute('fill', color)
        circle.setAttribute('stroke', '#000')
        circle.setAttribute('stroke-width', '0.8')
        circle.setAttribute('opacity', '0.92')
        g.appendChild(circle)

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', String(cx))
        text.setAttribute('y', String(cy + 3.5))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size', '7')
        text.setAttribute('font-weight', 'bold')
        text.setAttribute('fill', '#fff')
        text.setAttribute('font-family', 'sans-serif')
        text.textContent = String(total)
        g.appendChild(text)

        svg.appendChild(g)
      })
    }

    // Two rAF to ensure SVG has been painted and getBBox returns real values
    const id = requestAnimationFrame(() => requestAnimationFrame(render))
    return () => cancelAnimationFrame(id)
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
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}>
            <PurchaseButton compact />
          </div>

          {/* Phase panel — top left */}
          <PhasePanel />

          {/* Victory screen */}
          <GameOverOverlay />
        </div>
      </div>
    </div>
  )
}
