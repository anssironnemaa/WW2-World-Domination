import { useState } from 'react'
import { NATION_COLORS, useGameStore } from '../../store/gameStore'
import { unitName, UNIT_TYPES } from '../../data/units'
import { ADJACENCY, ZONE_KIND } from '../../data/adjacency'
import type { Territory, SeaZone, Nation } from '../../data/types'

type Props = {
  territory: Territory | null
  seaZone: SeaZone | null
  onClose: () => void
}

const UNIT_SHORT: Record<string, string> = {
  infantry: 'INF', tank: 'TNK', artillery: 'ART', fighter: 'FTR',
  bomber: 'BMB', destroyer: 'DD', submarine: 'SUB', cruiser: 'CA',
  battleship: 'BB', carrier: 'CV', transport: 'TP', 'aa-gun': 'AA', partisan: 'PAR',
}

export function TerritoryPanel({ territory, seaZone, onClose }: Props) {
  if (!territory && !seaZone) return null

  const zone = territory ?? seaZone!
  const isSea = zone.type === 'sea'
  const t = territory

  const ownerColor = t ? (NATION_COLORS[t.owner] ?? '#1a3a5c') : '#1a3a5c'

  // Flatten all units across all nations
  const unitMap: Record<string, { total: number; nations: Nation[] }> = {}

  Object.entries(zone.units).forEach(([nation, units]) => {
    Object.entries(units ?? {}).forEach(([uid, count]) => {
      if (!unitMap[uid]) unitMap[uid] = { total: 0, nations: [] }
      unitMap[uid].total += count
      unitMap[uid].nations.push(nation as Nation)
    })
  })

  const topUnits = Object.entries(unitMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 4)

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${ownerColor}88`,
      borderLeft: `3px solid ${ownerColor}`,
      borderRadius: 4,
      minWidth: 240,
      maxWidth: 300,
      color: '#e8e8d8',
      fontSize: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#0d0d0d',
        borderBottom: '1px solid #1e1e1e',
      }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>
            {(isSea ? zone.nameEN : (t?.nameEN ?? zone.nameEN ?? '')).toUpperCase()}
          </div>
          {t && t.isVC && (
            <div style={{ fontSize: 10, color: '#ffe066', marginTop: 1 }}>★ {t.vcName}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {t && (
            <div style={{
              fontSize: 14, fontWeight: 'bold', color: '#ffe066',
            }}>
              {t.ipc} IPC
            </div>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 0 }}
          >✕</button>
        </div>
      </div>

      {/* Unit badges */}
      <div style={{ padding: '8px 12px', borderBottom: topUnits.length > 0 ? '1px solid #1e1e1e' : 'none' }}>
        {topUnits.length > 0 ? (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {topUnits.map(([uid, info]) => {
              const short = UNIT_SHORT[uid] ?? uid.slice(0, 3).toUpperCase()
              const primaryNation = info.nations[0]
              const color = NATION_COLORS[primaryNation] ?? '#555'
              return (
                <div key={uid} style={{
                  background: color + '22',
                  border: `1px solid ${color}66`,
                  borderRadius: 3,
                  padding: '3px 7px',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 'bold', color: '#ddd',
                }}>
                  <span style={{ color: '#aaa', fontSize: 10 }}>{info.total}×</span>
                  {short}
                </div>
              )
            })}
            {Object.entries(unitMap).length > 4 && (
              <div style={{
                background: '#1e1e1e', border: '1px solid #333',
                borderRadius: 3, padding: '3px 7px',
                fontSize: 11, color: '#666',
              }}>
                +{Object.entries(unitMap).length - 4}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#444', fontStyle: 'italic' }}>No units</div>
        )}
      </div>

      {/* Badges row */}
      {t && (t.hasFactory || t.hasNavalBase || t.chokepoint || t.factoryDamage > 0) && (
        <div style={{ padding: '6px 12px', display: 'flex', gap: 5, flexWrap: 'wrap', borderBottom: '1px solid #1e1e1e' }}>
          {t.hasFactory && <SmallBadge label="⚙ FACTORY" color="#6a5a20" />}
          {t.hasNavalBase && <SmallBadge label="⚓ NAVAL" color="#1a3a6a" />}
          {t.chokepoint && <SmallBadge label={`🔒 ${t.chokepoint.toUpperCase()}`} color="#5a3a1a" />}
          {t.factoryDamage > 0 && <SmallBadge label={`DMG -${t.factoryDamage}`} color="#6a2020" />}
        </div>
      )}

      {/* Move planner (orders phase, own territory) */}
      <MovePlanner zoneId={zone.id} owner={t?.owner ?? null} />
    </div>
  )
}

function MovePlanner({ zoneId, owner }: { zoneId: string; owner: Nation | null }) {
  const game = useGameStore(s => s.game)
  const orderingNation = useGameStore(s => s.orderingNation)
  const pendingMove = useGameStore(s => s.pendingMove)
  const beginMove = useGameStore(s => s.beginMove)
  const [picks, setPicks] = useState<Record<string, number>>({})

  if (!game || game.phase !== 'orders' || !orderingNation) return null

  const isSea = !!game.seaZones[zoneId]
  const zone = game.territories[zoneId] ?? game.seaZones[zoneId]
  const myUnits = Object.entries(zone?.units[orderingNation] ?? {}).filter(([, n]) => n > 0)

  // Land zones are commanded by their owner; open-sea zones have no owner, so
  // any power with a fleet stationed there may order those ships to move.
  if (isSea) {
    if (myUnits.length === 0) {
      return <div style={{ padding: '8px 12px', fontSize: 10, color: '#666', borderTop: '1px solid #1e1e1e' }}>No fleet of yours in these waters.</div>
    }
  } else if (owner !== orderingNation) {
    return (
      <div style={{ padding: '8px 12px', fontSize: 10, color: '#666', borderTop: '1px solid #1e1e1e' }}>
        {owner ? `${owner} territory — not yours to command` : 'Inspect only'}
      </div>
    )
  }
  // Units already committed to pending orders from this zone
  const committed: Record<string, number> = {}
  for (const o of game.orders[orderingNation] ?? []) {
    if (o.from === zoneId) committed[o.unit] = (committed[o.unit] ?? 0) + o.count
  }

  if (myUnits.length === 0) {
    return <div style={{ padding: '8px 12px', fontSize: 10, color: '#666', borderTop: '1px solid #1e1e1e' }}>No movable units here.</div>
  }

  const totalPicked = Object.values(picks).reduce((s, n) => s + n, 0)
  const avail = (uid: string) => (zone!.units[orderingNation]![uid] ?? 0) - (committed[uid] ?? 0) - (picks[uid] ?? 0)
  const inc = (uid: string) => { if (avail(uid) > 0) setPicks(p => ({ ...p, [uid]: (p[uid] ?? 0) + 1 })) }
  const dec = (uid: string) => setPicks(p => { const v = (p[uid] ?? 0) - 1; const n = { ...p }; if (v <= 0) delete n[uid]; else n[uid] = v; return n })

  const start = () => {
    if (totalPicked === 0) return
    beginMove(zoneId, picks)
    setPicks({})
  }

  // Transport / carrier capacity in adjacent sea zones (for ferrying across water)
  const adjacentSeaCapacity = (ADJACENCY[zoneId] ?? [])
    .filter(z => ZONE_KIND[z] === 'sea')
    .map(z => {
      const sea = game.seaZones[z]
      const tp = (sea?.units[orderingNation]?.transport ?? 0) * 2
      const cv = (sea?.units[orderingNation]?.carrier ?? 0) * 2
      return { name: sea?.nameEN ?? z, tp, cv }
    })
    .filter(s => s.tp > 0 || s.cv > 0)

  return (
    <div style={{ borderTop: '1px solid #1e1e1e', padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: '#c8a830', fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 }}>PLAN SECRET MOVE</div>
      {myUnits.map(([uid, count]) => {
        const committedHere = committed[uid] ?? 0
        return (
          <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1, fontSize: 11, color: '#ddd' }}>
              {unitName(uid)} <span style={{ color: '#666' }}>· move {UNIT_TYPES[uid]?.move ?? 1} ({count}{committedHere ? ` · ${committedHere} moving` : ''})</span>
            </div>
            <button onClick={() => dec(uid)} disabled={(picks[uid] ?? 0) === 0} style={stepBtn((picks[uid] ?? 0) === 0)}>−</button>
            <span style={{ minWidth: 16, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: (picks[uid] ?? 0) > 0 ? '#ffe066' : '#555' }}>{picks[uid] ?? ''}</span>
            <button onClick={() => inc(uid)} disabled={avail(uid) <= 0} style={stepBtn(avail(uid) <= 0)}>+</button>
          </div>
        )
      })}
      <button
        onClick={start}
        disabled={totalPicked === 0 || !!pendingMove}
        style={{
          width: '100%', marginTop: 6, padding: '8px 0', borderRadius: 4, border: 'none',
          background: totalPicked > 0 && !pendingMove ? '#c8a830' : '#333',
          color: totalPicked > 0 && !pendingMove ? '#0d0d0d' : '#666',
          fontWeight: 'bold', fontSize: 11, letterSpacing: 1,
          cursor: totalPicked > 0 && !pendingMove ? 'pointer' : 'not-allowed',
        }}
      >
        {pendingMove ? 'CHOOSE DESTINATION ON MAP…' : `🎯 SELECT DESTINATION (${totalPicked})`}
      </button>
      <div style={{ fontSize: 9, color: '#667', marginTop: 6, lineHeight: 1.4 }}>
        Units advance up to their move each turn; farther targets become auto-continuing standing orders. Land units cross open sea only via a Transport, aircraft land at sea only on a Carrier.
      </div>
      {adjacentSeaCapacity.length > 0 && (
        <div style={{ fontSize: 9, color: '#8ab4d8', marginTop: 4 }}>
          {adjacentSeaCapacity.map((s, i) => (
            <div key={i}>🚢 {s.name}: {s.tp > 0 ? `${s.tp} transport slots` : ''}{s.tp > 0 && s.cv > 0 ? ' · ' : ''}{s.cv > 0 ? `${s.cv} carrier slots` : ''}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function stepBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 4, border: `1px solid ${disabled ? '#333' : '#c8a830'}`,
    background: disabled ? '#1a1a1a' : 'rgba(200,168,48,0.15)', color: disabled ? '#555' : '#ffe066',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, lineHeight: '18px', padding: 0,
  }
}

function SmallBadge({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      background: color + '33', border: `1px solid ${color}88`,
      borderRadius: 3, padding: '2px 6px',
      fontSize: 10, color: '#aaa', fontWeight: 'bold', letterSpacing: 0.5,
    }}>
      {label}
    </div>
  )
}
