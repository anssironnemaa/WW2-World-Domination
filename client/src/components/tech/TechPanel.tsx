import { useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { TECH_TREE, TECH_COST } from '../../data/tech'
import type { Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

export function TechPanel({ onClose }: { onClose: () => void }) {
  const game = useGameStore(s => s.game)!
  const buyTech = useGameStore(s => s.buyTech)
  const humanNations = NATIONS.filter(n => game.players[n]?.type === 'human')
  const [nation, setNation] = useState<Nation>(humanNations[0] ?? 'Germany')
  const [error, setError] = useState('')

  const player = game.players[nation]

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(6,8,12,0.96)',
      display: 'flex', flexDirection: 'column', color: '#e8e8d8', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #222' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#fff' }}>🔬 TECHNOLOGY & RESEARCH</div>
          <div style={{ fontSize: 11, color: '#a8b6ca', letterSpacing: 1 }}>{TECH_COST} IPC per level · four doctrines, three levels each</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #444', borderRadius: 4, color: '#ccc', padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>✕ CLOSE</button>
      </div>

      {/* Nation selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 22px', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#a8b6ca' }}>RESEARCH FOR:</span>
        {humanNations.map(n => (
          <button key={n} onClick={() => { setNation(n); setError('') }} style={{
            padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 'bold', cursor: 'pointer',
            background: nation === n ? NATION_COLORS[n] : NATION_COLORS[n] + '22',
            border: `1px solid ${NATION_COLORS[n]}`, color: nation === n ? '#fff' : '#aaa',
          }}>{n === 'USSR' ? 'SOVIET' : n.toUpperCase()}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#ffe066', fontWeight: 'bold' }}>{player.ipc} IPC</span>
      </div>
      {error && <div style={{ color: '#e05050', fontSize: 12, padding: '0 22px 8px' }}>{error}</div>}

      {/* Branches */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {TECH_TREE.map(branch => {
          const level = player.techLevels[branch.key]
          const canBuy = level < 3 && player.ipc >= TECH_COST
          return (
            <div key={branch.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #222', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{branch.icon} {branch.name}</span>
                <span style={{ fontSize: 11, color: '#a8b6ca' }}>Level {level}/3</span>
              </div>
              {/* Level pips */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[1, 2, 3].map(l => (
                  <div key={l} style={{ flex: 1, height: 5, borderRadius: 3, background: l <= level ? '#c8a830' : '#2a2a2a' }} />
                ))}
              </div>
              {/* Level descriptions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                {branch.levels.map((desc, i) => {
                  const lv = i + 1
                  const owned = lv <= level
                  const next = lv === level + 1
                  return (
                    <div key={i} style={{
                      fontSize: 11, lineHeight: 1.4, padding: '4px 8px', borderRadius: 4,
                      background: next ? 'rgba(200,168,48,0.08)' : 'transparent',
                      color: owned ? '#8fdc8f' : next ? '#ddd' : '#8f8f8f',
                    }}>
                      <b>T{lv}</b> {owned ? '✓ ' : ''}{desc}
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => setError(buyTech(nation, branch.key) ?? '')}
                disabled={!canBuy}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: 5, border: 'none',
                  background: canBuy ? '#c8a830' : '#2a2a2a', color: canBuy ? '#0d0d0d' : '#8f8f8f',
                  fontWeight: 'bold', fontSize: 12, letterSpacing: 1, cursor: canBuy ? 'pointer' : 'not-allowed',
                }}
              >
                {level >= 3 ? 'MAXED OUT' : `RESEARCH T${level + 1} — ${TECH_COST} IPC`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
