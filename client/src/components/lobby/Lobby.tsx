import { useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { listSaves, deleteSave, exportSave, importSaveFile, type SaveMeta } from '../../engine/saves'
import { roundToDate } from '../../data/calendar'
import { OnlineLobby } from '../online/OnlineLobby'
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
const TYPE_COLOR: Record<PlayerType, string> = { human: '#3a6b8a', ai: '#6a4a8a', npn: '#858585' }

export function Lobby() {
  const initGame = useGameStore(s => s.initGame)
  const loadWar = useGameStore(s => s.loadWar)
  const [rows, setRows] = useState<Record<PlayableNation, Row>>(DEFAULT_ROWS)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [warName, setWarName] = useState('')
  const [saves, setSaves] = useState<SaveMeta[]>(() => listSaves())
  const [mode, setMode] = useState<'local' | 'online'>('local')
  const refreshSaves = () => setSaves(listSaves())

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
    const name = warName.trim() || `War of ${new Date().toLocaleDateString()}`
    initGame(config, difficulty, name)
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, #14202c, #0a0d12)', color: '#e8e8d8',
    }}>
      <div style={{ width: 560, maxWidth: '92%', maxHeight: '92%', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 3, color: '#fff' }}>WORLD DOMINANCE</div>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#a8b6ca', marginTop: 4 }}>ASSEMBLE THE POWERS · 1939</div>
        </div>

        {/* Local (pass-and-play) vs Online (multi-device) */}
        <div style={{ display: 'flex', gap: 8, margin: '16px 0 4px' }}>
          {([['local', '🎮 LOCAL (pass-and-play)'], ['online', '🌐 ONLINE (join by code)']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '10px 0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', letterSpacing: 1,
              background: mode === m ? '#c8a83022' : 'rgba(255,255,255,0.03)', border: `1px solid ${mode === m ? '#c8a830' : '#333'}`,
              color: mode === m ? '#ffe066' : '#8899aa',
            }}>{label}</button>
          ))}
        </div>

        {mode === 'online' ? <div style={{ marginTop: 8 }}><OnlineLobby /></div> : <>

        {/* Continue / import a saved war */}
        {(saves.length > 0 || true) && (
          <div style={{ margin: '16px 0', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid #222' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1 }}>▸ SAVED WARS</span>
              <label style={{ fontSize: 10, color: '#8ab4d8', cursor: 'pointer', border: '1px solid #3a5b7a', borderRadius: 4, padding: '3px 8px' }}>
                ⬆ IMPORT FILE
                <input type="file" accept="application/json,.json" style={{ display: 'none' }}
                  onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return
                    const meta = await importSaveFile(f)
                    if (meta) refreshSaves(); else alert('That file is not a valid saved war.')
                    e.target.value = ''
                  }} />
              </label>
            </div>
            {saves.length === 0 ? (
              <div style={{ fontSize: 11, color: '#8a96aa', fontStyle: 'italic' }}>No saved wars yet — start one below, or import a save file.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {saves.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid #222' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: '#8a96aa' }}>{roundToDate(s.round).short} · saved {new Date(s.savedAt).toLocaleString()}</div>
                    </div>
                    <button onClick={() => loadWar(s.id)} style={{ padding: '5px 12px', borderRadius: 4, border: 'none', background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>▶ CONTINUE</button>
                    <button onClick={() => exportSave(s.id)} title="Export to file" style={{ background: 'none', border: '1px solid #3a5b7a', borderRadius: 4, color: '#8ab4d8', cursor: 'pointer', fontSize: 12, padding: '3px 7px' }}>⬇</button>
                    <button onClick={() => { if (confirm(`Delete saved war "${s.name}"?`)) { deleteSave(s.id); refreshSaves() } }} title="Delete" style={{ background: 'none', border: 'none', color: '#e05050', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 10, color: '#8a96aa', marginTop: 10 }}>— or start a new war below —</div>
          </div>
        )}

        {/* New war name */}
        <div style={{ margin: '16px 0 8px' }}>
          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, marginBottom: 5 }}>NAME THIS WAR</div>
          <input value={warName} onChange={e => setWarName(e.target.value)} placeholder="e.g. Operation Barbarossa"
            style={{ width: '100%', background: '#0f141a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 14 }} />
        </div>

        <div style={{ fontSize: 11, color: '#98a7bd', textAlign: 'center', margin: '10px 0 18px', lineHeight: 1.5 }}>
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
                  <div style={{ fontSize: 10, color: '#a8b6ca' }}>{STARTING_IPC[n]} IPC start</div>
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
          <span style={{ fontSize: 11, color: '#a8b6ca', letterSpacing: 1 }}>AI DIFFICULTY</span>
          {(['easy', 'normal', 'hard'] as AiDifficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)} style={{
              padding: '4px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 11, textTransform: 'capitalize',
              background: difficulty === d ? '#6a4a8a' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${difficulty === d ? '#9a7aba' : '#333'}`,
              color: difficulty === d ? '#fff' : '#999', fontWeight: difficulty === d ? 'bold' : 'normal',
            }}>{d}</button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#98a7bd' }}>
          {humanCount} human · {aiCount} AI · {NATIONS.length - humanCount - aiCount} neutral
          {!uniqueHumanPins && <span style={{ color: '#e0806a', marginLeft: 8 }}>· human PINs must be unique</span>}
          {!pinsOk && <span style={{ color: '#e0806a', marginLeft: 8 }}>· every human needs a 4-digit PIN</span>}
        </div>

        <button onClick={start} disabled={!canStart} style={{
          width: '100%', marginTop: 16, padding: '13px 0', borderRadius: 6, border: 'none',
          background: canStart ? '#c8a830' : '#333', color: canStart ? '#0d0d0d' : '#8f8f8f',
          fontWeight: 'bold', fontSize: 14, letterSpacing: 2, cursor: canStart ? 'pointer' : 'not-allowed',
        }}>▶ BEGIN THE WAR</button>

        <div style={{ textAlign: 'center', fontSize: 10, color: '#8a96aa', marginTop: 12, lineHeight: 1.5 }}>
          Hotseat mode — pass one device between human players; each unlocks their
          turn with their PIN. For separate devices, use ONLINE above.
        </div>
        </>}
      </div>
    </div>
  )
}
