import { NATION_COLORS } from '../../store/gameStore'
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
            {isSea ? zone.nameFI : (t?.nameEN?.toUpperCase() ?? zone.nameFI.toUpperCase())}
          </div>
          {t && (
            <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
              {t.nameFI} {t.isVC ? '★' : ''}
            </div>
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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 0 }}>
        <button style={{
          flex: 1, padding: '9px 0', border: 'none',
          background: '#c8a830', color: '#0d0d0d',
          fontWeight: 'bold', fontSize: 11, letterSpacing: 1,
          cursor: 'pointer',
        }}>
          ISSUE ORDER
        </button>
        <div style={{ width: 1, background: '#0d0d0d' }} />
        <button style={{
          width: 90, padding: '9px 0', border: 'none',
          background: '#1e1e1e', color: '#888',
          fontWeight: 'bold', fontSize: 11, letterSpacing: 1,
          cursor: 'pointer',
          borderLeft: '1px solid #2a2a2a',
        }}>
          DEFEND
        </button>
      </div>
    </div>
  )
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
