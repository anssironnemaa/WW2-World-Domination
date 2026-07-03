import { useGameStore } from '../../store/gameStore'

const PHASE_LABELS: Record<string, string> = {
  diplomacy: 'PHASE 1 · DIPLOMACY',
  purchase: 'PHASE 2 · PURCHASE',
  orders: 'PHASE 3 · ORDERS',
  combat: 'PHASE 4 · COMBAT',
  move: 'PHASE 5 · MOVEMENT',
  collect: 'PHASE 6 · COLLECT',
}

const YEAR_BY_ROUND: Record<number, string> = {
  1: 'SEP 1939', 2: 'JAN 1940', 3: 'APR 1940', 4: 'JUL 1940',
  5: 'OCT 1940', 6: 'JAN 1941', 7: 'APR 1941', 8: 'JUL 1941',
}

export function TopBar() {
  const game = useGameStore(s => s.game)
  if (!game) return null

  const phaseLabel = PHASE_LABELS[game.phase] ?? game.phase.toUpperCase()
  const dateLabel = YEAR_BY_ROUND[game.round] ?? `R${String(game.round).padStart(2, '0')}`

  return (
    <div style={{
      height: 40,
      background: '#0d0d0d',
      borderBottom: '1px solid #2a2a2a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 0,
      flexShrink: 0,
      zIndex: 30,
    }}>
      {/* Branding */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 210 }}>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: '#ffe066', letterSpacing: 1 }}>
          WORLD DOMINANCE
        </span>
        <span style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>
          R{String(game.round).padStart(2, '0')} · {dateLabel}
        </span>
      </div>

      {/* Center — phase + timer dots */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {/* Player ready dots */}
        <div style={{ display: 'flex', gap: 5 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i === 2 ? '#ffe066' : '#2a2a2a',
              border: '1px solid #444',
            }} />
          ))}
        </div>

        <span style={{ fontSize: 11, fontWeight: 'bold', color: '#c8b870', letterSpacing: 2 }}>
          {phaseLabel}
        </span>

        {/* Timer */}
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#e8e8d8', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
          ∞
        </span>
      </div>

      {/* Right spacer */}
      <div style={{ minWidth: 0 }} />
    </div>
  )
}
