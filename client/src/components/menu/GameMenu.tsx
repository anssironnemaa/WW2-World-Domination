import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { exportState } from '../../engine/saves'
import { roundToDate } from '../../data/calendar'

export function GameMenu() {
  const game = useGameStore(s => s.game)
  const online = useGameStore(s => s.online)
  const saveWar = useGameStore(s => s.saveWar)
  const endWar = useGameStore(s => s.endWar)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(game?.name ?? 'War')
  const [saved, setSaved] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  useEffect(() => { if (game?.name) setName(game.name) }, [game?.name])
  if (!game) return null

  const doSave = () => {
    saveWar(name.trim() || 'Untitled War')
    setSaved(true); setTimeout(() => setSaved(false), 1600)
  }
  const newSaving = () => { saveWar(name.trim() || 'Untitled War'); endWar() }
  const newDiscard = () => endWar()
  const exitSaving = () => { saveWar(name.trim() || 'Untitled War'); endWar() }
  const exitDiscard = () => endWar()

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
        background: '#1e1e1e', border: '1px solid #444', color: '#ddd', cursor: 'pointer', letterSpacing: 1,
      }}>☰ {game.name.length > 18 ? game.name.slice(0, 18) + '…' : game.name}</button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 260, zIndex: 60,
          background: '#101418', border: '1px solid #333', borderRadius: 8, padding: 12,
          boxShadow: '0 6px 24px rgba(0,0,0,0.7)', color: '#ddd',
        }}>
          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1 }}>CURRENT WAR · {roundToDate(game.round).short}</div>

          {online && (
            <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 6, background: 'rgba(200,168,48,0.09)', border: '1px solid #5a4a20' }}>
              <div style={{ fontSize: 10, color: '#c8a830', letterSpacing: 1 }}>ONLINE GAME CODE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 5, color: '#ffe066' }}>{online.code}</span>
                <button onClick={() => navigator.clipboard?.writeText(online.code)} style={{ marginLeft: 'auto', fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid #3a5b7a', background: 'rgba(58,91,122,0.2)', color: '#8ab4d8', cursor: 'pointer' }}>📋 COPY</button>
              </div>
              <div style={{ fontSize: 10, color: '#a8b6ca', marginTop: 5, lineHeight: 1.4 }}>
                Share this so a dropped player can rejoin: open the game → JOIN WITH CODE → their nation + PIN. You are {online.nation} ({online.role}).
              </div>
            </div>
          )}

          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, margin: '12px 0 5px' }}>SAVE / RENAME</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ flex: 1, background: '#0f141a', border: '1px solid #333', borderRadius: 4, color: '#fff', padding: '6px 8px', fontSize: 12 }} />
            <button onClick={doSave} style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: saved ? '#3a6b3a' : '#c8a830', color: saved ? '#fff' : '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>
              {saved ? '✓ SAVED' : '💾 SAVE'}
            </button>
          </div>
          <button onClick={() => exportState(name.trim() || 'War', game)} style={{ width: '100%', marginTop: 6, padding: '6px 0', borderRadius: 4, border: '1px solid #3a5b7a', background: 'rgba(58,91,122,0.2)', color: '#8ab4d8', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>
            ⬇ EXPORT TO FILE
          </button>

          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, margin: '14px 0 5px' }}>NEW WAR</div>
          {!confirmNew ? (
            <button onClick={() => setConfirmNew(true)} style={{ width: '100%', padding: '8px 0', borderRadius: 4, border: '1px solid #5a3f7a', background: 'rgba(90,63,122,0.2)', color: '#dce', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>
              🆕 START A NEW WAR
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, color: '#e0c070' }}>Save the current war first?</div>
              <button onClick={newSaving} style={{ padding: '7px 0', borderRadius: 4, border: 'none', background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>💾 SAVE & START NEW</button>
              <button onClick={newDiscard} style={{ padding: '7px 0', borderRadius: 4, border: '1px solid #6a2020', background: 'rgba(120,30,30,0.2)', color: '#e0a0a0', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>🗑 DISCARD & START NEW</button>
              <button onClick={() => setConfirmNew(false)} style={{ padding: '5px 0', background: 'none', border: 'none', color: '#a2a2a2', cursor: 'pointer', fontSize: 11 }}>cancel</button>
            </div>
          )}

          <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, margin: '14px 0 5px' }}>START SCREEN</div>
          {!confirmExit ? (
            <button onClick={() => setConfirmExit(true)} style={{ width: '100%', padding: '8px 0', borderRadius: 4, border: '1px solid #3a5b7a', background: 'rgba(58,91,122,0.2)', color: '#8ab4d8', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>
              ⌂ BACK TO START SCREEN
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, color: '#e0c070' }}>Save the current war before leaving?</div>
              <button onClick={exitSaving} style={{ padding: '7px 0', borderRadius: 4, border: 'none', background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>💾 SAVE & EXIT</button>
              <button onClick={exitDiscard} style={{ padding: '7px 0', borderRadius: 4, border: '1px solid #6a2020', background: 'rgba(120,30,30,0.2)', color: '#e0a0a0', fontWeight: 'bold', fontSize: 11, cursor: 'pointer' }}>🗑 EXIT WITHOUT SAVING</button>
              <button onClick={() => setConfirmExit(false)} style={{ padding: '5px 0', background: 'none', border: 'none', color: '#a2a2a2', cursor: 'pointer', fontSize: 11 }}>cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
