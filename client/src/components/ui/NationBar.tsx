import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import type { Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']
const FLAGS: Record<Nation, string> = {
  Germany: '🇩🇪', USSR: '⭐', UK: '🇬🇧', USA: '🇺🇸',
  Japan: '🇯🇵', France: '🇫🇷', Italy: '🇮🇹', Neutral: '', None: '',
}

export function NationBar() {
  const game = useGameStore(s => s.game)
  const calculateIncome = useGameStore(s => s.calculateIncome)
  if (!game) return null

  return (
    <div style={{
      display: 'flex',
      background: 'rgba(0,0,0,0.85)',
      borderBottom: '1px solid #333',
      padding: '4px 8px',
      gap: 4,
      flexWrap: 'wrap',
      zIndex: 20,
    }}>
      {NATIONS.map(nation => {
        const player = game.players[nation]
        if (!player) return null
        const income = calculateIncome(nation)
        const color = NATION_COLORS[nation]
        return (
          <div key={nation} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 5,
            background: color + '22',
            border: `1px solid ${color}55`,
            fontSize: 12,
          }}>
            <span style={{ fontSize: 14 }}>{FLAGS[nation]}</span>
            <span style={{ color: '#ccc', fontWeight: 'bold' }}>{nation}</span>
            <span style={{ color: '#ffe066', marginLeft: 2 }}>
              💰 {player.ipc}
            </span>
            <span style={{ color: '#8acd8a', fontSize: 11 }}>
              +{income}
            </span>
            <span style={{ color: '#888', fontSize: 10, marginLeft: 2 }}>
              {player.type === 'ai' ? 'AI' : player.type === 'npn' ? 'NPN' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
