import { useGameStore } from '../../store/gameStore'
import { roundToDate } from '../../data/calendar'

const PHASE_LABELS: Record<string, string> = {
  diplomacy: 'PHASE 1 · DIPLOMACY',
  purchase: 'PHASE 2 · PURCHASE',
  orders: 'PHASE 3 · SECRET ORDERS',
  reveal: 'PHASE 4 · REVEAL',
  battle: 'PHASE 5 · BATTLE',
  income: 'PHASE 6 · INCOME',
}

export function TopBar() {
  const game = useGameStore(s => s.game)
  const viewMode = useGameStore(s => s.viewMode)
  const setViewMode = useGameStore(s => s.setViewMode)
  const isMobile = viewMode === 'mobile'
  if (!game) return null

  const phaseLabel = PHASE_LABELS[game.phase] ?? game.phase.toUpperCase()
  const dateLabel = roundToDate(game.round).short

  return (
    <div style={{
      height: 40,
      background: '#0d0d0d',
      borderBottom: '1px solid #2a2a2a',
      display: 'flex',
      alignItems: 'center',
      padding: isMobile ? '0 8px' : '0 16px',
      gap: isMobile ? 8 : 0,
      flexShrink: 0,
      zIndex: 30,
    }}>
      {/* Branding */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: isMobile ? 0 : 210, flexShrink: 0 }}>
        <span style={{ fontSize: isMobile ? 12 : 15, fontWeight: 'bold', color: '#ffe066', letterSpacing: isMobile ? 0.5 : 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
          {isMobile ? 'W·DOMINANCE' : 'WORLD DOMINANCE'}
        </span>
        <span style={{ fontSize: 11, color: '#d6c68a', letterSpacing: 1, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {dateLabel}
        </span>
      </div>

      {/* Center — phase + timer dots */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 2 ? '#ffe066' : '#2a2a2a', border: '1px solid #444' }} />
            ))}
          </div>
        )}

        <span style={{ fontSize: 11, fontWeight: 'bold', color: '#c8b870', letterSpacing: isMobile ? 1 : 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {phaseLabel}
        </span>

        {!isMobile && (
          <span style={{ fontSize: 12, fontWeight: 'bold', color: '#e8e8d8', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>∞</span>
        )}
      </div>

      {/* View toggle — desktop vs mobile-optimised layout */}
      <button
        onClick={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
        title={viewMode === 'mobile' ? 'Switch to desktop layout' : 'Switch to mobile layout'}
        style={{
          flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid #3a4655', background: 'rgba(255,255,255,0.05)', color: '#cdd6e2',
          fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5,
        }}>
        {viewMode === 'mobile' ? '📱' : '🖥'}<span style={{ letterSpacing: 0.5 }}>{viewMode === 'mobile' ? 'MOBILE' : 'DESKTOP'}</span>
      </button>
    </div>
  )
}
