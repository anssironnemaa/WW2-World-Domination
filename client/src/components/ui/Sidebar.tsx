import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import type { Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

const NATION_LABELS: Record<string, string> = {
  Germany: 'GERMANY', USSR: 'SOVIET UNION', UK: 'BRITAIN',
  USA: 'UNITED STATES', Japan: 'JAPAN', France: 'FRANCE', Italy: 'ITALY',
}


function starRating(ipc: number): number {
  if (ipc >= 40) return 3
  if (ipc >= 25) return 2
  return 1
}

export function Sidebar() {
  const game = useGameStore(s => s.game)
  const online = useGameStore(s => s.online)
  const calculateIncome = useGameStore(s => s.calculateIncome)
  if (!game) return null

  // Which nation is "you": your online seat, else the first human power.
  const youNation = (online?.nation ?? NATIONS.find(n => game.players[n]?.type === 'human') ?? 'Germany') as Nation

  return (
    <div style={{
      width: 210,
      flexShrink: 0,
      background: '#111',
      borderRight: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid #2a2a2a',
        fontSize: 10,
        color: '#8f8f8f',
        letterSpacing: 2,
        fontWeight: 'bold',
      }}>
        POWERS · {NATIONS.length}
      </div>

      {/* Nation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {NATIONS.map(nation => {
          const player = game.players[nation]
          if (!player) return null
          const income = calculateIncome(nation)
          const color = NATION_COLORS[nation]
          const territoryCount = Object.values(game.territories).filter(t => t.owner === nation).length
          const stars = starRating(player.ipc)
          const isEliminated = territoryCount === 0

          const isYou = nation === youNation
          return (
            <div key={nation} style={{
              padding: '10px 14px 10px 11px',
              borderBottom: '1px solid #1e1e1e',
              borderLeft: `3px solid ${isYou ? color : color + '66'}`,
              background: isYou ? 'rgba(255,255,255,0.035)' : 'transparent',
              opacity: isEliminated ? 0.4 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {/* Color indicator dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, flexShrink: 0,
                  boxShadow: `0 0 6px ${color}`,
                }} />
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#e8e8d8', letterSpacing: 0.5 }}>
                  {NATION_LABELS[nation] ?? nation}
                </span>
                {/* Online status */}
                <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: isEliminated ? '#858585' : '#4caf50' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ffe066', lineHeight: 1 }}>
                    {player.ipc}
                  </div>
                  <div style={{ fontSize: 10, color: '#8f8f8f', marginTop: 2 }}>
                    {territoryCount} TERR
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} style={{ fontSize: 10, color: i < stars ? '#ffe066' : '#333' }}>★</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 'bold', color: '#6bbf6b' }}>+{income}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer — this device's player */}
      <div style={{
        padding: '9px 14px',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        color: '#cfcbbb',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: NATION_COLORS[youNation], boxShadow: `0 0 6px ${NATION_COLORS[youNation]}` }} />
        YOU — {NATION_LABELS[youNation] ?? youNation}
      </div>
    </div>
  )
}
