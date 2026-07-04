import { useEffect, useMemo, useRef, useState } from 'react'
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
import { TechPanel } from '../tech/TechPanel'
import { GameMenu } from '../menu/GameMenu'
import { UNIT_TYPES } from '../../data/units'
import type { GameState, Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

export const UNIT_SHORT: Record<string, string> = {
  infantry: 'INF', tank: 'TNK', artillery: 'ART', mechanized_infantry: 'MEC',
  fighter: 'FTR', bomber: 'BMB', submarine: 'SUB', destroyer: 'DD', cruiser: 'CA',
  carrier: 'CV', transport: 'TP', battleship: 'BB', partisan: 'PAR',
}

type Anchors = Record<string, [number, number]>

export function MapView() {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [anchors, setAnchors] = useState<Anchors>({})
  const [showStats, setShowStats] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [showWarRoom, setShowWarRoom] = useState(false)
  const [showTech, setShowTech] = useState(false)
  const game = useGameStore(s => s.game)
  const selectedZoneId = useGameStore(s => s.selectedZoneId)
  const selectZone = useGameStore(s => s.selectZone)
  const handleZoneClick = useGameStore(s => s.handleZoneClick)
  const orderingNation = useGameStore(s => s.orderingNation)
  const pendingMove = useGameStore(s => s.pendingMove)
  const cancelMove = useGameStore(s => s.cancelMove)

  useEffect(() => {
    fetch('/worldmap.svg').then(r => r.text()).then(setSvgContent)
  }, [])

  // Parse the baked anchor coordinates once, for the React overlay.
  useEffect(() => {
    if (!svgContent) return
    const map: Anchors = {}
    const re = /data-id="([^"]+)"[^>]*?data-cx="([-\d.]+)"\s+data-cy="([-\d.]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(svgContent))) map[m[1]] = [parseFloat(m[2]), parseFloat(m[3])]
    setAnchors(map)
  }, [svgContent])

  // Click handling is done with a React onClick on the map container (below) —
  // robust against SVG re-injection, unlike an imperatively-attached listener.
  const onMapClick = (e: React.MouseEvent) => {
    const target = (e.target as Element).closest('[data-id]')
    handleZoneClick(target ? target.getAttribute('data-id') : null)
  }

  // Ownership colors + selection highlight on the base map (fills only)
  useEffect(() => {
    const svg = mapRef.current?.querySelector('svg')
    if (!game || !svg) return
    Object.values(game.territories).forEach(t => {
      const color = NATION_COLORS[t.owner] ?? NATION_COLORS['Neutral']
      svg.querySelectorAll<SVGElement>(`[data-id="${t.id}"]`).forEach(el => { el.style.fill = color })
    })
    svg.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'))
    if (selectedZoneId) svg.querySelector(`#${selectedZoneId}`)?.classList.add('selected')
  }, [game, selectedZoneId, svgContent])

  const selectedTerritory = selectedZoneId && game ? game.territories[selectedZoneId] ?? null : null
  const selectedSeaZone = selectedZoneId && game ? game.seaZones[selectedZoneId] ?? null : null

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <TransformWrapper initialScale={1} minScale={0.3} maxScale={8} wheel={{ step: 0.1 }} panning={{ velocityDisabled: true }}>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', background: '#1a4a6a' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              {svgContent ? (
                <div ref={mapRef} onClick={onMapClick} style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <div style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: svgContent }} />
                  {/* React-managed overlay: units, arrows, battle marks (never vanish) */}
                  <svg viewBox="0 0 1400 760" preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {game && <MapOverlay anchors={anchors} game={game} />}
                  </svg>
                </div>
              ) : (
                <div style={{ color: '#888', padding: 40, fontSize: 14, letterSpacing: 2 }}>LOADING MAP...</div>
              )}
            </TransformComponent>
          </TransformWrapper>

          {(selectedTerritory || selectedSeaZone) && (
            <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
              <TerritoryPanel territory={selectedTerritory} seaZone={selectedSeaZone} onClose={() => selectZone(null)} />
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, background: 'rgba(10,10,10,0.85)', border: '1px solid #2a2a2a',
            borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 300,
          }}>
            {NATIONS.map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#888' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: NATION_COLORS[n] }} />
                {n === 'USSR' ? 'SOVIET UNION' : n.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Top-right buttons */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 20, display: 'flex', gap: 6 }}>
            <button onClick={() => setShowStats(true)} style={topBtn('#2a3b4a', '#3a5b7a', '#cde')}>📊 STATS</button>
            <button onClick={() => setShowEvents(true)} style={topBtn('#3a2f4a', '#5a3f7a', '#dce')}>📜 CHRONICLE</button>
            <button onClick={() => setShowWarRoom(true)} style={topBtn('#3a3320', '#6a5a20', '#e8d9a0')}>🎖️ WAR ROOM</button>
            <button onClick={() => setShowTech(true)} style={topBtn('#2a3a2a', '#3a6a3a', '#bfe0bf')}>🔬 TECH</button>
            <PurchaseButton compact />
            <GameMenu />
          </div>

          {showStats && <StatsPanel onClose={() => setShowStats(false)} />}
          {showEvents && <EventsPanel onClose={() => setShowEvents(false)} />}
          {showWarRoom && <WarRoomPanel onClose={() => setShowWarRoom(false)} />}
          {showTech && <TechPanel onClose={() => setShowTech(false)} />}

          <PhasePanel />

          {/* Orders phase: on-map nation picker + turn/targeting banner */}
          {game?.phase === 'orders' && !orderingNation && <OnMapOrdersBar />}
          {game?.phase === 'orders' && orderingNation && (
            <TurnBanner nation={orderingNation} targeting={!!pendingMove} onCancel={cancelMove} />
          )}

          <GameOverOverlay />
        </div>
      </div>
    </div>
  )
}

function topBtn(bg: string, border: string, color: string): React.CSSProperties {
  return { padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold', background: bg, border: `1px solid ${border}`, color, cursor: 'pointer', letterSpacing: 1 }
}

// ── React SVG overlay: unit chips, movement arrows, battle marks ───────────────
function MapOverlay({ anchors, game }: { anchors: Anchors; game: GameState }) {
  const CHIP_W = 21, CHIP_H = 7.5, GAP = 1

  const arrows = game.revealedArrows
  const battles = game.revealedBattles

  const chipsByZone = useMemo(() => {
    const all = { ...game.territories, ...game.seaZones }
    return Object.entries(all).map(([zoneId, zone]) => {
      const chips: { nation: Nation; unit: string; count: number }[] = []
      for (const [nation, units] of Object.entries(zone.units)) {
        for (const [unit, count] of Object.entries(units ?? {})) {
          if (count > 0) chips.push({ nation: nation as Nation, unit, count })
        }
      }
      chips.sort((a, b) => a.nation.localeCompare(b.nation) || (UNIT_TYPES[a.unit]?.cost ?? 0) - (UNIT_TYPES[b.unit]?.cost ?? 0))
      return { zoneId, chips }
    }).filter(z => z.chips.length > 0)
  }, [game.territories, game.seaZones])

  return (
    <>
      {/* Battle marks */}
      {battles.map(b => {
        const a = anchors[b.zoneId]; if (!a) return null
        return (
          <g key={`bm-${b.zoneId}`}>
            <circle cx={a[0]} cy={a[1]} r={4.2} fill="#c0392b" stroke="#000" strokeWidth={0.5} />
            <circle cx={a[0]} cy={a[1] - 0.4} r={2} fill="#ffcc33" />
          </g>
        )
      })}

      {/* Movement arrows */}
      {arrows.map((o, idx) => {
        const s = anchors[o.from], d = anchors[o.to]; if (!s || !d) return null
        const [sx, sy] = s, [dx, dy] = d
        const dxv = dx - sx, dyv = dy - sy
        const len = Math.hypot(dxv, dyv) || 1
        const nx = -dyv / len, ny = dxv / len
        const bow = Math.min(40, len * 0.18) * (idx % 2 === 0 ? 1 : -1)
        const mx = (sx + dx) / 2 + nx * bow, my = (sy + dy) / 2 + ny * bow
        const t = Math.max(0, 1 - 7 / len)
        const ex = mx + (dx - mx) * t, ey = my + (dy - my) * t
        const color = NATION_COLORS[o.nation] ?? '#fff'
        const dStr = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`
        const ang = Math.atan2(dy - my, dx - mx), ah = 7
        const head = `${dx},${dy} ${dx - ah * Math.cos(ang - 0.4)},${dy - ah * Math.sin(ang - 0.4)} ${dx - ah * Math.cos(ang + 0.4)},${dy - ah * Math.sin(ang + 0.4)}`
        return (
          <g key={`ar-${idx}`}>
            <path d={dStr} fill="none" stroke="#000" strokeWidth={4.5} strokeLinecap="round" opacity={0.5} />
            <path d={dStr} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" opacity={0.95} strokeDasharray="5 3" />
            <polygon points={head} fill={color} stroke="#000" strokeWidth={0.4} />
            <text x={mx} y={my - 2} textAnchor="middle" fontSize={6} fontWeight="bold" fill="#fff" stroke="#000" strokeWidth={0.3} fontFamily="sans-serif">
              {o.count} {UNIT_SHORT[o.unit] ?? o.unit.slice(0, 3).toUpperCase()}
            </text>
          </g>
        )
      })}

      {/* Unit chips */}
      {chipsByZone.map(({ zoneId, chips }) => {
        const a = anchors[zoneId]; if (!a) return null
        const [cx, cy] = a
        const startY = cy - (chips.length * (CHIP_H + GAP)) / 2
        return (
          <g key={`u-${zoneId}`}>
            {chips.map((chip, i) => {
              const y = startY + i * (CHIP_H + GAP)
              const color = NATION_COLORS[chip.nation] ?? '#888'
              const code = UNIT_SHORT[chip.unit] ?? chip.unit.slice(0, 3).toUpperCase()
              return (
                <g key={i}>
                  <rect x={cx - CHIP_W / 2} y={y} width={CHIP_W} height={CHIP_H} rx={1.5} fill={color} stroke="#000" strokeWidth={0.4} opacity={0.95} />
                  <text x={cx} y={y + CHIP_H - 2} textAnchor="middle" fontSize={5} fontWeight="bold" fill="#fff" fontFamily="sans-serif">{chip.count} {code}</text>
                </g>
              )
            })}
          </g>
        )
      })}
    </>
  )
}

// ── On-map nation picker (orders phase) ───────────────────────────────────────
function OnMapOrdersBar() {
  const game = useGameStore(s => s.game)!
  const setOrderingNation = useGameStore(s => s.setOrderingNation)
  const [sel, setSel] = useState<Nation | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  const humans = NATIONS.filter(n => game.players[n]?.type === 'human' && !game.lockedNations.includes(n))
  if (humans.length === 0) {
    return (
      <div style={bannerBox('rgba(10,10,10,0.9)', '#3a5b7a')}>
        <span>All players have locked orders — advance to reveal from the panel.</span>
      </div>
    )
  }
  const go = () => {
    if (!sel) return
    if (pin === game.players[sel].pin) { setOrderingNation(sel); setErr(''); setPin('') }
    else setErr('Wrong PIN')
  }
  return (
    <div style={bannerBox('rgba(10,10,10,0.94)', '#c8a830')}>
      {!sel ? (
        <>
          <span style={{ color: '#c8a830' }}>ISSUE ORDERS AS:</span>
          {humans.map(n => (
            <button key={n} onClick={() => setSel(n)} style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', cursor: 'pointer',
              background: NATION_COLORS[n] + '33', border: `1px solid ${NATION_COLORS[n]}`, color: '#fff',
            }}>{n === 'USSR' ? 'SOVIET' : n.toUpperCase()}</button>
          ))}
        </>
      ) : (
        <>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: NATION_COLORS[sel], display: 'inline-block' }} />
          <span style={{ color: '#fff' }}>{sel.toUpperCase()} — PIN:</span>
          <input autoFocus type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()}
            style={{ width: 64, background: '#1a1a1a', border: '1px solid #444', borderRadius: 4, color: '#fff', padding: '4px 6px', fontSize: 12, textAlign: 'center', letterSpacing: 2 }} />
          <button onClick={go} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>GO</button>
          <button onClick={() => { setSel(null); setPin(''); setErr('') }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11 }}>✕</button>
          {err && <span style={{ color: '#e05050', fontSize: 11 }}>{err}</span>}
        </>
      )}
    </div>
  )
}

function TurnBanner({ nation, targeting, onCancel }: { nation: Nation; targeting: boolean; onCancel: () => void }) {
  const lockOrders = useGameStore(s => s.lockOrders)
  const setOrderingNation = useGameStore(s => s.setOrderingNation)
  const game = useGameStore(s => s.game)!
  const moveMessage = useGameStore(s => s.moveMessage)
  const myOrders = game.orders[nation] ?? []
  const isError = moveMessage && !moveMessage.startsWith('Standing')
  return (
    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 25, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
    <div style={{ ...bannerBox(targeting ? 'rgba(200,168,48,0.95)' : 'rgba(10,10,10,0.92)', targeting ? '#ffe066' : NATION_COLORS[nation]), position: 'static', transform: 'none' }}>
      {targeting ? (
        <>
          <span style={{ color: '#0d0d0d', fontWeight: 'bold' }}>🎯 CLICK A DESTINATION ZONE</span>
          <button onClick={onCancel} style={{ background: '#0d0d0d', color: '#ffe066', border: 'none', borderRadius: 12, fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
        </>
      ) : (
        <>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: NATION_COLORS[nation], display: 'inline-block' }} />
          <span style={{ color: '#fff' }}>{nation.toUpperCase()} — click your zones to move ({myOrders.length} order{myOrders.length === 1 ? '' : 's'})</span>
          <button onClick={() => { lockOrders(nation); setOrderingNation(null) }} style={{ padding: '3px 10px', borderRadius: 12, border: 'none', background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>✓ LOCK</button>
          <button onClick={() => setOrderingNation(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11 }}>switch</button>
        </>
      )}
    </div>
    {moveMessage && (
      <div style={{
        maxWidth: 460, whiteSpace: 'normal', textAlign: 'center', padding: '5px 12px', borderRadius: 12, fontSize: 11,
        background: isError ? 'rgba(120,30,30,0.95)' : 'rgba(30,90,50,0.95)', border: `1px solid ${isError ? '#e05050' : '#5aa06a'}`,
        color: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      }}>{isError ? '⚠ ' : '✓ '}{moveMessage}</div>
    )}
    </div>
  )
}

function bannerBox(bg: string, border: string): React.CSSProperties {
  return {
    position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 25,
    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 20,
    background: bg, border: `1px solid ${border}`, fontSize: 12, fontWeight: 'bold',
    boxShadow: '0 2px 12px rgba(0,0,0,0.6)', color: '#fff', whiteSpace: 'nowrap',
  }
}
