import { useEffect, useRef, useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { mp, seatsToPlayerConfig, type RoomInfo, type SeatConfig } from '../../engine/online'
import { roundToDate } from '../../data/calendar'
import type { Nation, AiDifficulty } from '../../data/types'

const NATIONS = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy'] as const
const LABEL: Record<string, string> = {
  Germany: 'Germany', USSR: 'Soviet Union', UK: 'Britain', USA: 'United States',
  Japan: 'Japan', France: 'France', Italy: 'Italy',
}

const box: React.CSSProperties = { background: '#0f141a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 14, width: '100%' }
const primaryBtn = (on: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 0', borderRadius: 6, border: 'none', fontWeight: 'bold', fontSize: 14,
  letterSpacing: 1, background: on ? '#c8a830' : '#333', color: on ? '#0d0d0d' : '#8f8f8f', cursor: on ? 'pointer' : 'not-allowed',
})

export function OnlineLobby() {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['create', 'join'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold', letterSpacing: 1,
            background: tab === t ? '#2a4a6a' : 'rgba(255,255,255,0.04)', border: `1px solid ${tab === t ? '#4a7aaa' : '#333'}`,
            color: tab === t ? '#fff' : '#8899aa',
          }}>{t === 'create' ? '🏳 CREATE A WAR' : '🔑 JOIN WITH CODE'}</button>
        ))}
      </div>
      {tab === 'create' ? <CreateWar /> : <JoinWar />}
    </div>
  )
}

// ── Host: create + configure + waiting room ───────────────────────────────────
function CreateWar() {
  const initGame = useGameStore(s => s.initGame)
  const setOnline = useGameStore(s => s.setOnline)
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [seatTypes, setSeatTypes] = useState<Record<string, 'ai' | 'human'>>(
    () => Object.fromEntries(NATIONS.map((n, i) => [n, i === 0 ? 'human' : i < 3 ? 'human' : 'ai'])) as Record<string, 'ai' | 'human'>)
  const [hostNation, setHostNation] = useState<Nation>('Germany')
  const [hostName, setHostName] = useState('')
  const [pin, setPin] = useState('')
  const [room, setRoom] = useState<{ code: string; hostToken: string; kv: boolean } | null>(null)
  const [live, setLive] = useState<RoomInfo | null>(null)
  const [busy, setBusy] = useState(false)

  const cycle = (n: string) => setSeatTypes(s => ({ ...s, [n]: s[n] === 'human' ? 'ai' : 'human' }))

  // Poll the waiting room to show who has joined.
  useEffect(() => {
    if (!room) return
    let stop = false
    const loop = async () => {
      while (!stop) { try { const r = await mp.room(room.code); if (r.room) setLive(r.room) } catch { /**/ } await new Promise(r => setTimeout(r, 2000)) }
    }
    loop()
    return () => { stop = true }
  }, [room])

  const humanSeats = NATIONS.filter(n => seatTypes[n] === 'human') as string[]
  const canCreate = humanSeats.includes(hostNation) && pin.length === 4 && humanSeats.length >= 1

  const create = async () => {
    setBusy(true)
    const seats: SeatConfig = Object.fromEntries(NATIONS.map(n => [n, { type: seatTypes[n] }]))
    const res = await mp.create(name.trim() || 'Online War', seats)
    setBusy(false)
    if ((res as any).error) { alert((res as any).error); return }
    setRoom(res)
  }

  const begin = () => {
    if (!room) return
    const seats: SeatConfig = Object.fromEntries(NATIONS.map(n => [n, { type: seatTypes[n] }]))
    const cfg = { ...seatsToPlayerConfig(seats, hostNation, pin), Neutral: { type: 'npn' as const, pin: '0000' }, None: { type: 'npn' as const, pin: '0000' } }
    initGame(cfg as any, difficulty, name.trim() || 'Online War')
    const g = useGameStore.getState().game!
    setOnline({ code: room.code, role: 'host', nation: hostNation, pin, hostToken: room.hostToken })
    mp.start(room.code, room.hostToken, g, roundToDate(g.round).long)
  }

  if (room) {
    const claimed = live ? Object.entries(live.seats).filter(([, s]) => s.type === 'human' && s.claimed) : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center', padding: 16, borderRadius: 8, background: 'rgba(200,168,48,0.08)', border: '1px solid #5a4a20' }}>
          <div style={{ fontSize: 11, color: '#c8a830', letterSpacing: 2 }}>SHARE THIS GAME CODE</div>
          <div style={{ fontSize: 40, fontWeight: 'bold', letterSpacing: 8, color: '#ffe066', margin: '6px 0' }}>{room.code}</div>
          <div style={{ fontSize: 11, color: '#a8b6ca' }}>Others open the game, tap <b>JOIN WITH CODE</b>, and enter this.</div>
          {!room.kv && <div style={{ fontSize: 10, color: '#e0a060', marginTop: 6 }}>⚠ No KV configured — cross-device play needs KV env vars in production.</div>}
        </div>
        <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1 }}>SEATS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {NATIONS.map(n => {
            const seat = live?.seats[n]
            const you = n === hostNation
            const who = you ? `${hostName.trim() || 'You'} (host)` : seat?.type === 'ai' ? '🤖 AI' : seat?.claimed ? `👤 ${seat.name}` : '… waiting for a player'
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${NATION_COLORS[n]}`, border: '1px solid #222', borderLeftWidth: 4 }}>
                <div style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: 'bold' }}>{LABEL[n]}</div>
                <div style={{ fontSize: 12, color: seat?.claimed || you || seat?.type === 'ai' ? '#9fd8a0' : '#889' }}>{who}</div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: '#98a7bd', textAlign: 'center' }}>
          {claimed.length} of {humanSeats.length - 1} remote {humanSeats.length - 1 === 1 ? 'player has' : 'players have'} joined. You can begin whenever you like — unclaimed human seats simply wait.
        </div>
        <button onClick={begin} style={primaryBtn(true)}>▶ BEGIN THE WAR</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1, marginBottom: 5 }}>WAR NAME</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Grand Alliance" style={box} />
      </div>
      <div style={{ fontSize: 11, color: '#98a7bd', lineHeight: 1.5 }}>
        Set each power to a Human seat (for you or a friend joining on their own device) or AI. Then pick which one is <b>yours</b>.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {NATIONS.map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${NATION_COLORS[n]}`, border: '1px solid #222', borderLeftWidth: 4 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 'bold', color: '#fff' }}>{LABEL[n]}</div>
            {seatTypes[n] === 'human' && (
              <button onClick={() => setHostNation(n)} style={{
                fontSize: 10, padding: '4px 9px', borderRadius: 4, cursor: 'pointer',
                background: hostNation === n ? '#c8a830' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${hostNation === n ? '#e0c060' : '#444'}`, color: hostNation === n ? '#0d0d0d' : '#aaa', fontWeight: 'bold',
              }}>{hostNation === n ? '★ YOURS' : 'play this'}</button>
            )}
            <button onClick={() => cycle(n)} style={{
              width: 96, padding: '6px 0', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
              background: (seatTypes[n] === 'human' ? '#3a6b8a' : '#6a4a8a') + '33',
              border: `1px solid ${seatTypes[n] === 'human' ? '#3a6b8a' : '#6a4a8a'}`, color: '#fff',
            }}>{seatTypes[n] === 'human' ? '👤 Human' : '🤖 AI'}</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={hostName} onChange={e => setHostName(e.target.value)} placeholder="Your name" style={{ ...box, flex: 1 }} />
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Your PIN" inputMode="numeric"
          style={{ ...box, width: 110, textAlign: 'center', letterSpacing: 4 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#a8b6ca', letterSpacing: 1 }}>AI DIFFICULTY</span>
        {(['easy', 'normal', 'hard'] as AiDifficulty[]).map(d => (
          <button key={d} onClick={() => setDifficulty(d)} style={{
            padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11, textTransform: 'capitalize',
            background: difficulty === d ? '#6a4a8a' : 'rgba(255,255,255,0.04)', border: `1px solid ${difficulty === d ? '#9a7aba' : '#333'}`,
            color: difficulty === d ? '#fff' : '#999',
          }}>{d}</button>
        ))}
      </div>
      <button onClick={create} disabled={!canCreate || busy} style={primaryBtn(canCreate && !busy)}>
        {busy ? 'CREATING…' : '🌐 CREATE GAME & GET CODE'}
      </button>
      {!canCreate && <div style={{ fontSize: 10, color: '#e0806a', textAlign: 'center' }}>Pick a Human seat as yours and set a 4-digit PIN.</div>}
    </div>
  )
}

// ── Guest: join with code, claim a seat, wait for start ───────────────────────
function JoinWar() {
  const setOnline = useGameStore(s => s.setOnline)
  const setGameFromView = useGameStore(s => s.setGameFromView)
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [nation, setNation] = useState<Nation | ''>('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const enteredRef = useRef(false)

  const lookup = async () => {
    setError('')
    const r = await mp.room(code.trim().toUpperCase())
    if (r.error || !r.room) { setError(r.error || 'No such game'); return }
    setRoom(r.room)
  }

  const join = async () => {
    if (!room || !nation) return
    setError('')
    const r = await mp.join(room.code, nation, name.trim() || nation, pin)
    if (r.error) { setError(r.error); return }
    setJoined(true)
    if (r.room) setRoom(r.room)
  }

  // Once joined, poll until the host starts, then enter the game.
  useEffect(() => {
    if (!joined || !room || !nation) return
    let stop = false
    const loop = async () => {
      while (!stop && !enteredRef.current) {
        try {
          const r = await mp.room(room.code); if (r.room) setRoom(r.room)
          if (r.room?.started) {
            const v = await mp.view(room.code, nation, pin)
            if (v.state) {
              enteredRef.current = true
              setOnline({ code: room.code, role: 'guest', nation, pin })
              setGameFromView(v.state)
              return
            }
          }
        } catch { /**/ }
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    loop()
    return () => { stop = true }
  }, [joined, room, nation, pin, setOnline, setGameFromView])

  if (joined) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 15, color: '#ffe066', fontWeight: 'bold' }}>You are {LABEL[nation as string]}.</div>
        <div style={{ fontSize: 12, color: '#a8b6ca', marginTop: 8 }}>Waiting for the host to begin the war…</div>
        <div style={{ fontSize: 22, marginTop: 12 }}>⏳</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, color: '#98a7bd', textAlign: 'center' }}>Enter the code your host shared.</div>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 5))} placeholder="ABCDE"
          style={{ ...box, textAlign: 'center', letterSpacing: 8, fontSize: 28, fontWeight: 'bold' }} />
        <button onClick={lookup} disabled={code.trim().length < 4} style={primaryBtn(code.trim().length >= 4)}>🔎 FIND GAME</button>
        {error && <div style={{ color: '#e05050', fontSize: 12, textAlign: 'center' }}>{error}</div>}
      </div>
    )
  }

  const openSeats = NATIONS.filter(n => room.seats[n]?.type === 'human' && !room.seats[n]?.claimed)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ textAlign: 'center', fontSize: 15, color: '#fff', fontWeight: 'bold' }}>{room.name}</div>
      <div style={{ fontSize: 10, color: '#a8b6ca', letterSpacing: 1 }}>CHOOSE AN OPEN NATION</div>
      {openSeats.length === 0 ? (
        <div style={{ fontSize: 12, color: '#e0806a', textAlign: 'center' }}>No open human seats — all are taken or AI.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {openSeats.map(n => (
            <button key={n} onClick={() => setNation(n)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              background: nation === n ? NATION_COLORS[n] + '33' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${nation === n ? NATION_COLORS[n] : '#222'}`, borderLeft: `4px solid ${NATION_COLORS[n]}`,
            }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 'bold', color: '#fff' }}>{LABEL[n]}</span>
              {nation === n && <span style={{ color: '#ffe066', fontSize: 12 }}>★ selected</span>}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={{ ...box, flex: 1 }} />
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Set a PIN" inputMode="numeric"
          style={{ ...box, width: 110, textAlign: 'center', letterSpacing: 4 }} />
      </div>
      <button onClick={join} disabled={!nation || pin.length !== 4} style={primaryBtn(!!nation && pin.length === 4)}>✓ CLAIM {nation ? LABEL[nation as string].toUpperCase() : 'NATION'}</button>
      {error && <div style={{ color: '#e05050', fontSize: 12, textAlign: 'center' }}>{error}</div>}
    </div>
  )
}
