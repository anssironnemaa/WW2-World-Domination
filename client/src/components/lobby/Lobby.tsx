import { useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import type { Nation, PlayerType, AiDifficulty } from '../../data/types'

const NATIONS = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy'] as const
type PlayableNation = (typeof NATIONS)[number]
const NATION_LABELS: Record<string, string> = {
  Germany: 'Germany', USSR: 'Soviet Union', UK: 'Britain',
  USA: 'United States', Japan: 'Japan', France: 'France', Italy: 'Italy',
}
const STARTING_IPC: Record<string, number> = {
  Germany: 30, USSR: 28, UK: 25, USA: 40, Japan: 16, France: 15, Italy: 10,
}

type Row = { type: PlayerType; pin: string }

const DEFAULT_ROWS: Record<PlayableNation, Row> = {
  Germany: { type: 'human', pin: '1111' },
  USSR: { type: 'human', pin: '2222' },
  UK: { type: 'ai', pin: '3333' },
  USA: { type: 'ai', pin: '4444' },
  Japan: { type: 'ai', pin: '5555' },
  France: { type: 'ai', pin: '6666' },
  Italy: { type: 'ai', pin: '7777' },
}

const TYPE_CYCLE: PlayerType[] = ['human', 'ai', 'npn']
const TYPE_LABEL: Record<PlayerType, string> = { human: '👤 Human', ai: '🤖 AI', npn: '⚙ Neutral' }
const TYPE_COLOR: Record<PlayerType, string> = { human: '#3a6b8a', ai: '#6a4a8a', npn: '#555' }

export function Lobby() {
  const initGame = useGameStore(s => s.initGame)
  const [rows, setRows] = useState<Record<PlayableNation, Row>>(DEFAULT_ROWS)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')

  const cycleType = (n: PlayableNation) => setRows(r => {
    const idx = TYPE_CYCLE.indexOf(r[n].type)
    return { ...r, [n]: { ...r[n], type: TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length] } }
  })
  const setPin = (n: PlayableNation, pin: string) =>
    setRows(r => ({ ...r, [n]: { ...r[n], pin: pin.replace(/\D/g, '').slice(0, 4) } }))

  const humanCount = NATIONS.filter(n => rows[n].type === 'human').length
  const aiCount = NATIONS.filter(n => rows[n].type === 'ai').length
  const pinsOk = NATIONS.every(n => rows[n].type !== 'human' || rows[n].pin.length === 4)
  const uniqueHumanPins = (() => {
    const pins = NATIONS.filter(n => rows[n].type === 'human').map(n => rows[n].pin)
    return new Set(pins).size === pins.length
  })()
  const canStart = humanCount + aiCount >= 2 && pinsOk && uniqueHumanPins

  const start = () => {
    if (!canStart) return
    const config = { ...rows, Neutral: { type: 'npn', pin: '0000' }, None: { type: 'npn', pin: '0000' } } as Record<Nation, { type: PlayerType; pin: string }>
    initGame(config, difficulty)
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, #14202c, #0a0d12)', color: '#e8e8d8',
    }}>
      <div style={{ width: 560, maxWidth: '92%', maxHeight: '92%', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 3, color: '#fff' }}>WORLD DOMINANCE</div>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#8a9bb0', marginTop: 4 }}>ASSEMBLE THE POWERS · 1939</div>
        </div>

        <div style={{ fontSize: 11, color: '#7a8aa0', textAlign: 'center', margin: '14px 0 18px', lineHeight: 1.5 }}>
          Tap each power to set it as Human, AI, or Neutral. Human players enter a
          secret 4-digit PIN to lock in their orders during the game.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {NATIONS.map(n => {
            const row = rows[n]
            return (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 6,
                background: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${NATION_COLORS[n]}`,
                border: '1px solid #222', borderLeftWidth: 4,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{NATION_LABELS[n]}</div>
                  <div style={{ fontSize: 10, color: '#8a9bb0' }}>{STARTING_IPC[n]} IPC start</div>
                </div>

                {row.type === 'human' && (
                  <input
                    value={row.pin}
                    onChange={e => setPin(n, e.target.value)}
                    placeholder="PIN"
                    inputMode="numeric"
                    style={{
                      width: 62, textAlign: 'center', letterSpacing: 3, fontSize: 13,
                      background: '#0f141a', border: `1px solid ${row.pin.length === 4 ? '#3a6b8a' : '#553'}`,
                      borderRadius: 4, color: '#fff', padding: '6px 4px',
                    }}
                  />
                )}

                <button onClick={() => cycleType(n)} style={{
                  width: 108, padding: '7px 0', borderRadius: 5, cursor: 'pointer',
                  background: TYPE_COLOR[row.type] + '33', border: `1px solid ${TYPE_COLOR[row.type]}`,
                  color: '#fff', fontSize: 12, fontWeight: 'bold',
                }}>{TYPE_LABEL[row.type]}</button>
              </div>
            )
          })}
        </div>

        {/* AI difficulty */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: '#8a9bb0', letterSpacing: 1 }}>AI DIFFICULTY</span>
          {(['easy', 'normal', 'hard'] as AiDifficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)} style={{
              padding: '4px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 11, textTransform: 'capitalize',
              background: difficulty === d ? '#6a4a8a' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${difficulty === d ? '#9a7aba' : '#333'}`,
              color: difficulty === d ? '#fff' : '#999', fontWeight: difficulty === d ? 'bold' : 'normal',
            }}>{d}</button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#7a8aa0' }}>
          {humanCount} human · {aiCount} AI · {NATIONS.length - humanCount - aiCount} neutral
          {!uniqueHumanPins && <span style={{ color: '#e0806a', marginLeft: 8 }}>· human PINs must be unique</span>}
          {!pinsOk && <span style={{ color: '#e0806a', marginLeft: 8 }}>· every human needs a 4-digit PIN</span>}
        </div>

        <button onClick={start} disabled={!canStart} style={{
          width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 6, border: 'none',
          background: canStart ? '#c8a830' : '#333', color: canStart ? '#0d0d0d' : '#666',
          fontWeight: 'bold', fontSize: 14, letterSpacing: 2, cursor: canStart ? 'pointer' : 'not-allowed',
        }}>▶ BEGIN THE WAR</button>

        <div style={{ textAlign: 'center', fontSize: 10, color: '#556', marginTop: 12, lineHeight: 1.5 }}>
          Hotseat mode — pass one device between human players; each unlocks their
          turn with their PIN. Networked multi-device play is coming next.
        </div>
      </div>
    </div>
  )
}
