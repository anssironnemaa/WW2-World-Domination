import { useMemo, useState } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { UNIT_TYPES } from '../../data/units'
import { requestAiMove, type AiResult } from '../../engine/ai'
import { requestBulletin, requestBattleNarration, type NarrativeResult } from '../../engine/narrative'
import type { Nation } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

const PHASE_LABELS: Record<string, string> = {
  diplomacy: 'DIPLOMACY', purchase: 'PURCHASE', orders: 'SECRET ORDERS',
  reveal: 'REVEAL', battle: 'BATTLE', income: 'INCOME',
}

export function PhasePanel() {
  const game = useGameStore(s => s.game)
  const advancePhase = useGameStore(s => s.advancePhase)
  const [open, setOpen] = useState(true)
  if (!game) return null

  const humanNations = NATIONS.filter(n => game.players[n]?.type === 'human')
  const allLocked = game.phase !== 'orders' ||
    humanNations.every(n => game.lockedNations.includes(n))

  return (
    <div style={{
      position: 'absolute', top: 8, left: 8, zIndex: 20,
      background: 'rgba(10,10,10,0.92)', border: '1px solid #2a2a2a', borderRadius: 4,
      width: 300, maxHeight: 'calc(100% - 80px)', display: 'flex', flexDirection: 'column',
      color: '#ddd', fontSize: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', borderBottom: open ? '1px solid #1e1e1e' : 'none', cursor: 'pointer',
      }} onClick={() => setOpen(o => !o)}>
        <div style={{ fontWeight: 'bold', fontSize: 11, letterSpacing: 1, color: '#c8a830' }}>
          {PHASE_LABELS[game.phase] ?? game.phase.toUpperCase()}
        </div>
        <div style={{ color: '#555', fontSize: 10 }}>{open ? '▾' : '▸'}</div>
      </div>

      {open && (
        <div style={{ overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {game.phase === 'diplomacy' && <DiplomacyConsole />}
          {game.phase === 'purchase' && (
            <div style={{ color: '#888', fontSize: 11, lineHeight: 1.5 }}>
              Each nation buys units with the 🛒 PURCHASE button (top right).
              Purchases go to the production queue and deploy at the chosen factory when built.
            </div>
          )}
          {game.phase === 'orders' && <><OrdersEditor /><AiControl /><EspionagePanel /></>}
          {game.phase === 'reveal' && <><SpyReportsView /><RevealTable /></>}
          {game.phase === 'battle' && <BattleReports />}
          {game.phase === 'income' && <IncomeSummary />}

          <button
            onClick={advancePhase}
            disabled={!allLocked && game.phase === 'orders'}
            style={{
              padding: '8px 0', border: 'none', borderRadius: 3,
              background: (allLocked || game.phase !== 'orders') ? '#c8a830' : '#333',
              color: (allLocked || game.phase !== 'orders') ? '#0d0d0d' : '#666',
              fontWeight: 'bold', fontSize: 11, letterSpacing: 1,
              cursor: (allLocked || game.phase !== 'orders') ? 'pointer' : 'not-allowed',
            }}
          >
            {game.phase === 'income' ? `▶ START ROUND ${game.round + 1}` : '▶ NEXT PHASE'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Secret orders editor ──────────────────────────────────────────────────────
function OrdersEditor() {
  const game = useGameStore(s => s.game)!
  const submitOrder = useGameStore(s => s.submitOrder)
  const removeOrder = useGameStore(s => s.removeOrder)
  const lockOrders = useGameStore(s => s.lockOrders)

  const [nation, setNation] = useState<Nation | null>(null)
  const [pin, setPin] = useState('')
  const [pinOk, setPinOk] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [unit, setUnit] = useState('')
  const [count, setCount] = useState(1)
  const [to, setTo] = useState('')

  const humanNations = NATIONS.filter(n => game.players[n]?.type === 'human')

  // Zones where the active nation has units
  const sourceZones = useMemo(() => {
    if (!nation) return []
    const zones = [...Object.values(game.territories), ...Object.values(game.seaZones)]
    return zones.filter(z => Object.values(z.units[nation] ?? {}).some(n => n > 0))
  }, [game, nation])

  const sourceUnits = useMemo(() => {
    if (!nation || !from) return []
    const zone = game.territories[from] ?? game.seaZones[from]
    return Object.entries(zone?.units[nation] ?? {}).filter(([, n]) => n > 0)
  }, [game, nation, from])

  const allZones = useMemo(() =>
    [...Object.values(game.territories), ...Object.values(game.seaZones)]
      .sort((a, b) => a.nameEN.localeCompare(b.nameEN))
  , [game])

  const locked = nation ? game.lockedNations.includes(nation) : false
  const myOrders = nation ? (game.orders[nation] ?? []) : []

  const selectNation = (n: Nation) => {
    setNation(n); setPin(''); setPinOk(false); setError(''); setFrom(''); setUnit(''); setTo('')
  }

  const tryPin = () => {
    if (nation && pin === game.players[nation].pin) { setPinOk(true); setError('') }
    else setError('Wrong PIN')
  }

  const addOrder = () => {
    if (!nation || !from || !unit || !to) return
    const err = submitOrder({ nation, from, to, unit, count })
    setError(err ?? '')
    if (!err) { setUnit(''); setTo(''); setCount(1) }
  }

  const zoneName = (id: string) =>
    (game.territories[id] ?? game.seaZones[id])?.nameEN ?? id

  return (
    <>
      {/* Nation selector */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {humanNations.map(n => (
          <button key={n} onClick={() => selectNation(n)} style={{
            padding: '3px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
            background: nation === n ? NATION_COLORS[n] : NATION_COLORS[n] + '22',
            border: `1px solid ${NATION_COLORS[n]}`,
            color: nation === n ? '#fff' : '#aaa',
            fontWeight: nation === n ? 'bold' : 'normal',
          }}>
            {n}{game.lockedNations.includes(n) ? ' 🔒' : ''}
          </button>
        ))}
      </div>

      {nation && !pinOk && !locked && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="password" placeholder="PIN" value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryPin()}
            style={{
              flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 3,
              color: '#fff', padding: '5px 8px', fontSize: 12,
            }}
          />
          <button onClick={tryPin} style={{
            padding: '5px 12px', borderRadius: 3, border: 'none',
            background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer',
          }}>UNLOCK</button>
        </div>
      )}

      {nation && locked && (
        <div style={{ color: '#7acd7a', fontSize: 11 }}>🔒 Orders locked for {nation}</div>
      )}

      {nation && pinOk && !locked && (
        <>
          {/* Order form */}
          <select value={from} onChange={e => { setFrom(e.target.value); setUnit('') }} style={selStyle}>
            <option value="">From zone…</option>
            {sourceZones.map(z => <option key={z.id} value={z.id}>{z.nameEN}</option>)}
          </select>
          {from && (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...selStyle, flex: 1 }}>
                <option value="">Unit…</option>
                {sourceUnits.map(([uid, n]) =>
                  <option key={uid} value={uid}>{UNIT_TYPES[uid]?.nameFI ?? uid} ({n})</option>)}
              </select>
              <input
                type="number" min={1} value={count}
                onChange={e => setCount(Math.max(1, Number(e.target.value)))}
                style={{ ...selStyle, width: 52 }}
              />
            </div>
          )}
          {unit && (
            <select value={to} onChange={e => setTo(e.target.value)} style={selStyle}>
              <option value="">To zone…</option>
              {allZones.filter(z => z.id !== from).map(z =>
                <option key={z.id} value={z.id}>{z.nameEN}{z.type === 'sea' ? ' ⚓' : ''}</option>)}
            </select>
          )}
          {to && (
            <button onClick={addOrder} style={{
              padding: '6px 0', borderRadius: 3, border: 'none',
              background: NATION_COLORS[nation], color: '#fff', fontWeight: 'bold',
              fontSize: 11, cursor: 'pointer',
            }}>+ ADD ORDER</button>
          )}
          {error && <div style={{ color: '#e05050', fontSize: 11 }}>{error}</div>}

          {/* Order list */}
          {myOrders.length > 0 && (
            <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 6 }}>
              {myOrders.map(o => (
                <div key={o.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 11, marginBottom: 3, color: '#ccc',
                }}>
                  <span>{o.count}× {UNIT_TYPES[o.unit]?.nameFI ?? o.unit}: {zoneName(o.from)} → {zoneName(o.to)}</span>
                  <button onClick={() => removeOrder(nation, o.id)} style={{
                    background: 'none', border: 'none', color: '#e05050', cursor: 'pointer', fontSize: 12,
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { lockOrders(nation); setPinOk(false) }} style={{
            padding: '7px 0', borderRadius: 3, border: '1px solid #c8a830',
            background: 'transparent', color: '#c8a830', fontWeight: 'bold',
            fontSize: 11, letterSpacing: 1, cursor: 'pointer',
          }}>🔒 LOCK ORDERS ({myOrders.length})</button>
        </>
      )}
    </>
  )
}

// ── Reveal table ─────────────────────────────────────────────────────────────
function RevealTable() {
  const game = useGameStore(s => s.game)!
  const zoneName = (id: string) =>
    (game.territories[id] ?? game.seaZones[id])?.nameEN ?? id

  const entries = (Object.entries(game.orders) as [Nation, typeof game.orders[Nation]][])
    .filter(([, orders]) => (orders?.length ?? 0) > 0)

  if (entries.length === 0) {
    return <div style={{ color: '#888', fontSize: 11 }}>No orders were issued this round.</div>
  }
  return (
    <>
      {entries.map(([nation, orders]) => (
        <div key={nation}>
          <div style={{
            fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 3,
            color: NATION_COLORS[nation],
          }}>{nation.toUpperCase()}</div>
          {(orders ?? []).map(o => (
            <div key={o.id} style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>
              {o.count}× {UNIT_TYPES[o.unit]?.nameFI ?? o.unit}: {zoneName(o.from)} → {zoneName(o.to)}
            </div>
          ))}
        </div>
      ))}
      <div style={{ color: '#888', fontSize: 10, fontStyle: 'italic' }}>
        Advancing executes all movements simultaneously and resolves battles.
      </div>
    </>
  )
}

// ── Battle reports ───────────────────────────────────────────────────────────
function BattleReports() {
  const game = useGameStore(s => s.game)!
  const [expanded, setExpanded] = useState<string | null>(null)
  const [narration, setNarration] = useState<Record<string, NarrativeResult | 'loading'>>({})

  const narrate = async (zoneId: string) => {
    setNarration(n => ({ ...n, [zoneId]: 'loading' }))
    try {
      const res = await requestBattleNarration(useGameStore.getState().game!, zoneId)
      setNarration(n => ({ ...n, [zoneId]: res }))
    } catch {
      setNarration(n => ({ ...n, [zoneId]: { text: 'Dispatch lost in transmission.', source: 'mock' } }))
    }
  }

  if (game.battleReports.length === 0) {
    return <div style={{ color: '#888', fontSize: 11 }}>No battles this round.</div>
  }
  return (
    <>
      {game.battleReports.map(b => {
        const narr = narration[b.zoneId]
        return (
          <div key={b.zoneId} style={{
            border: '1px solid #2a2a2a', borderRadius: 3, padding: 8,
            borderLeft: `3px solid ${b.winner === 'attacker' ? NATION_COLORS[b.attacker] : NATION_COLORS[b.defender]}`,
          }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === b.zoneId ? null : b.zoneId)}
            >
              <span style={{ fontWeight: 'bold', fontSize: 11 }}>{b.zoneName}</span>
              <span style={{
                fontSize: 10,
                color: b.winner === 'attacker' ? '#7acd7a' : b.winner === 'defender' ? '#e08a8a' : '#c8a830',
              }}>
                {b.winner === 'attacker' ? `${b.attacker} WINS` : b.winner === 'defender' ? `${b.defender} HOLDS` : 'DRAW'}
              </span>
            </div>
            {expanded === b.zoneId && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#999', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {b.log.join('\n')}
              </div>
            )}
            {narr && narr !== 'loading' && (
              <div style={{
                marginTop: 6, padding: 6, borderRadius: 3, background: 'rgba(200,168,48,0.07)',
                fontSize: 10, color: '#d8c98a', fontStyle: 'italic', lineHeight: 1.5,
              }}>
                “{narr.text}”
                <span style={{ fontStyle: 'normal', color: '#666', fontSize: 8 }}> — {narr.source === 'gemini' ? 'war correspondent' : 'field report'}</span>
              </div>
            )}
            <button
              onClick={() => narrate(b.zoneId)}
              disabled={narr === 'loading'}
              style={{
                marginTop: 6, background: 'none', border: '1px solid #333', borderRadius: 3,
                color: narr === 'loading' ? '#666' : '#c8a830', fontSize: 9, padding: '2px 6px',
                cursor: narr === 'loading' ? 'default' : 'pointer',
              }}
            >{narr === 'loading' ? '📰 filing…' : narr ? '📰 re-narrate' : '📰 narrate'}</button>
          </div>
        )
      })}
    </>
  )
}

// ── Income summary ───────────────────────────────────────────────────────────
function IncomeSummary() {
  const game = useGameStore(s => s.game)!
  const [bulletin, setBulletin] = useState<NarrativeResult | 'loading' | null>(null)

  const generate = async () => {
    setBulletin('loading')
    try {
      setBulletin(await requestBulletin(useGameStore.getState().game!))
    } catch {
      setBulletin({ text: 'The wire went dead before the bulletin came through.', source: 'mock' })
    }
  }

  return (
    <>
      {NATIONS.map(n => {
        const income = game.incomeReport[n] ?? 0
        return (
          <div key={n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: NATION_COLORS[n], fontWeight: 'bold' }}>{n}</span>
            <span style={{ color: '#ccc' }}>
              +{income} IPC <span style={{ color: '#c8a830' }}>→ {game.players[n]?.ipc ?? 0}</span>
            </span>
          </div>
        )
      })}
      {(Object.values(game.productionQueues).flat().length > 0) && (
        <div style={{ color: '#888', fontSize: 10, borderTop: '1px solid #1e1e1e', paddingTop: 6 }}>
          Production queues advanced — finished units deployed at their factories.
        </div>
      )}

      {/* War bulletin */}
      <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 8 }}>
        <div style={{ fontSize: 10, color: '#c8a830', fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 }}>📰 WAR BULLETIN</div>
        {bulletin && bulletin !== 'loading' && (
          <div style={{
            padding: 8, borderRadius: 3, background: 'rgba(200,168,48,0.07)',
            fontSize: 11, color: '#d8c98a', fontStyle: 'italic', lineHeight: 1.55, marginBottom: 6,
          }}>
            “{bulletin.text}”
            <span style={{ fontStyle: 'normal', color: '#666', fontSize: 8 }}> — {bulletin.source === 'gemini' ? 'World Service' : 'field wire'}</span>
          </div>
        )}
        <button onClick={generate} disabled={bulletin === 'loading'} style={{
          width: '100%', padding: '5px 0', borderRadius: 3, border: '1px solid #333',
          background: 'none', color: bulletin === 'loading' ? '#666' : '#c8a830',
          fontSize: 10, cursor: bulletin === 'loading' ? 'default' : 'pointer',
        }}>
          {bulletin === 'loading' ? 'BROADCASTING…' : bulletin ? 'REGENERATE BULLETIN' : 'GENERATE ROUND BULLETIN'}
        </button>
      </div>
    </>
  )
}

// ── Diplomacy console ────────────────────────────────────────────────────────
const CMD_TEMPLATES = [
  '[ALLIANCE: Germany, Italy]',
  '[TRANSFER: 5 IPC, FROM: Germany, TO: Italy, ROUTE: Alps]',
  '[NON-AGGRESSION: 3 rounds, PARTIES: Germany, USSR]',
  '[MERCENARY: 6 IPC, UNIT: Panssarivaunu, OWNER: Italy, HIRER: Germany]',
]

function DiplomacyConsole() {
  const game = useGameStore(s => s.game)!
  const applyCommand = useGameStore(s => s.applyDiplomacyCommand)
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    if (!text.trim()) return
    const err = applyCommand(text)
    setError(err ?? '')
    if (!err) setText('')
  }

  const active = [
    ...game.alliances.map(a => `⚔ ${a.parties.join(' + ')}`),
    ...game.pacts.map(p => `🕊 ${p.parties.join(' + ')} (until R${p.untilRound})`),
    ...game.mercenaries.map(m => `💰 ${m.hirer}←${m.owner} ${UNIT_TYPES[m.unit]?.nameFI ?? m.unit}`),
  ]

  return (
    <>
      <div style={{ color: '#888', fontSize: 11, lineHeight: 1.5 }}>
        Issue treaty commands. IPC transfers and mercenary payments apply immediately.
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        placeholder="[ALLIANCE: Germany, Italy]"
        rows={2}
        style={{ ...selStyle, fontFamily: 'monospace', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {CMD_TEMPLATES.map(t => (
          <button key={t} onClick={() => setText(t)} title={t} style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 3,
            color: '#888', fontSize: 9, padding: '2px 5px', cursor: 'pointer',
          }}>{t.slice(1, t.indexOf(':'))}</button>
        ))}
      </div>
      <button onClick={submit} style={{
        padding: '6px 0', borderRadius: 3, border: 'none',
        background: '#c8a830', color: '#0d0d0d', fontWeight: 'bold', fontSize: 11, cursor: 'pointer',
      }}>▶ EXECUTE COMMAND</button>
      {error && <div style={{ color: '#e05050', fontSize: 11 }}>{error}</div>}

      {active.length > 0 && (
        <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 6 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>ACTIVE TREATIES</div>
          {active.map((a, i) => <div key={i} style={{ fontSize: 11, color: '#bbb' }}>{a}</div>)}
        </div>
      )}
      {game.diplomacyLog.length > 0 && (
        <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 6, maxHeight: 90, overflowY: 'auto' }}>
          {game.diplomacyLog.slice().reverse().map((e, i) => (
            <div key={i} style={{ fontSize: 10, color: '#777' }}>R{e.round}: {e.text}</div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Espionage panel (orders phase) ───────────────────────────────────────────
function EspionagePanel() {
  const game = useGameStore(s => s.game)!
  const submitSpy = useGameStore(s => s.submitSpyOrder)
  const clearSpy = useGameStore(s => s.clearSpyOrders)
  const buyIntel = useGameStore(s => s.buyIntel)

  const [spy, setSpy] = useState<Nation | ''>('')
  const [target, setTarget] = useState<Nation | ''>('')
  const [points, setPoints] = useState(1)
  const [error, setError] = useState('')

  const humanNations = NATIONS.filter(n => game.players[n]?.type === 'human')

  const send = () => {
    if (!spy || !target) return
    const err = submitSpy(spy, target as Nation, points)
    setError(err ?? '')
  }

  const myOrders = spy ? game.spyOrders.filter(s => s.spy === spy) : []

  return (
    <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, color: '#c8a830', fontWeight: 'bold', letterSpacing: 1 }}>🕵 ESPIONAGE</div>
      <select value={spy} onChange={e => { setSpy(e.target.value as Nation); setError('') }} style={selStyle}>
        <option value="">Acting nation…</option>
        {humanNations.map(n => (
          <option key={n} value={n}>
            {n} — {game.players[n].ipc} IPC{game.players[n].codeBreaking ? ' 📡' : ''}{game.players[n].encryption ? ' 🔐' : ''}
          </option>
        ))}
      </select>
      {spy && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={target} onChange={e => setTarget(e.target.value as Nation)} style={{ ...selStyle, flex: 1 }}>
              <option value="">Spy on…</option>
              {NATIONS.filter(n => n !== spy).map(n => <option key={n} value={n}>{n}</option>)}
              <option value={spy}>{spy} (defensive shield)</option>
            </select>
            <input type="number" min={1} value={points}
              onChange={e => setPoints(Math.max(1, Number(e.target.value)))}
              style={{ ...selStyle, width: 46 }} title="spy points × 5 IPC" />
          </div>
          {target && (
            <button onClick={send} style={{
              padding: '5px 0', borderRadius: 3, border: 'none',
              background: NATION_COLORS[spy], color: '#fff', fontWeight: 'bold', fontSize: 11, cursor: 'pointer',
            }}>+ SPEND {points * 5} IPC ({points}pt)</button>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setError(buyIntel(spy, 'codeBreaking') ?? '')}
              disabled={game.players[spy].codeBreaking}
              style={intelBtn(game.players[spy].codeBreaking)}>📡 Code-break (20)</button>
            <button onClick={() => setError(buyIntel(spy, 'encryption') ?? '')}
              disabled={game.players[spy].encryption}
              style={intelBtn(game.players[spy].encryption)}>🔐 Encrypt (10)</button>
          </div>
          {error && <div style={{ color: '#e05050', fontSize: 11 }}>{error}</div>}
          {myOrders.length > 0 && (
            <div>
              {myOrders.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: '#bbb' }}>
                  {s.spy === s.target ? '🛡' : '🎯'} {s.target}: {s.points}pt
                </div>
              ))}
              <button onClick={() => clearSpy(spy)} style={{
                background: 'none', border: 'none', color: '#e05050', fontSize: 10, cursor: 'pointer', padding: 0, marginTop: 2,
              }}>✕ clear & refund</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Spy reports (reveal phase) ───────────────────────────────────────────────
function SpyReportsView() {
  const game = useGameStore(s => s.game)!
  const zoneName = (id: string) => (game.territories[id] ?? game.seaZones[id])?.nameEN ?? id
  if (game.spyReports.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 10, color: '#c8a830', fontWeight: 'bold', letterSpacing: 1 }}>🕵 INTELLIGENCE</div>
      {game.spyReports.map((r, i) => (
        <div key={i} style={{
          border: '1px solid #2a2a2a', borderRadius: 3, padding: 6,
          borderLeft: `3px solid ${r.success ? '#7acd7a' : '#666'}`,
        }}>
          <div style={{ fontSize: 10, color: r.success ? '#cbe8cb' : '#999' }}>{r.detail}</div>
          {r.revealedOrders && r.revealedOrders.length > 0 && (
            <div style={{ marginTop: 4, paddingLeft: 6, borderLeft: '1px solid #333' }}>
              {r.revealedOrders.map(o => (
                <div key={o.id} style={{ fontSize: 10, color: '#c8a830' }}>
                  {o.count}× {UNIT_TYPES[o.unit]?.nameFI ?? o.unit}: {zoneName(o.from)} → {zoneName(o.to)}
                </div>
              ))}
            </div>
          )}
          {r.revealedOrders && r.revealedOrders.length === 0 && (
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>(target issued no orders)</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── AI control (orders phase) ─────────────────────────────────────────────────
function AiControl() {
  const submitOrder = useGameStore(s => s.submitOrder)
  const lockOrders = useGameStore(s => s.lockOrders)
  const game = useGameStore(s => s.game)!
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<{ nation: Nation; res: AiResult; err?: string }[]>([])

  const aiNations = NATIONS.filter(n => ['ai', 'npn'].includes(game.players[n]?.type))
  const pending = aiNations.filter(n => !game.lockedNations.includes(n))

  const zoneName = (id: string) => (game.territories[id] ?? game.seaZones[id])?.nameEN ?? id

  const run = async () => {
    setRunning(true)
    // Fire every AI nation's request concurrently, then apply results in order so
    // "THINKING…" time is bounded by the slowest call, not the sum of all calls.
    const snapshot = useGameStore.getState().game!
    const settled = await Promise.all(pending.map(async (nation): Promise<{ nation: Nation; res: AiResult; err?: string }> => {
      try {
        return { nation, res: await requestAiMove(snapshot, nation) }
      } catch (e) {
        return { nation, res: { moves: [], reasoning: '', source: 'mock' }, err: e instanceof Error ? e.message : String(e) }
      }
    }))
    for (const { nation, res, err } of settled) {
      if (err) continue
      for (const m of res.moves) submitOrder({ nation, from: m.from, to: m.to, unit: m.unit, count: m.count })
      lockOrders(nation)
    }
    setResults(settled)
    setRunning(false)
  }

  if (aiNations.length === 0) return null
  return (
    <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, color: '#c8a830', fontWeight: 'bold', letterSpacing: 1 }}>🤖 AI COMMAND</div>
      <button onClick={run} disabled={running || pending.length === 0} style={{
        padding: '6px 0', borderRadius: 3, border: 'none',
        background: (running || pending.length === 0) ? '#333' : '#3a6b8a',
        color: (running || pending.length === 0) ? '#666' : '#fff',
        fontWeight: 'bold', fontSize: 11, cursor: (running || pending.length === 0) ? 'default' : 'pointer',
      }}>
        {running ? 'THINKING…' : pending.length === 0 ? 'ALL AI NATIONS ORDERED' : `RUN AI NATIONS (${pending.length})`}
      </button>
      {results.map(({ nation, res, err }) => (
        <div key={nation} style={{ border: '1px solid #2a2a2a', borderRadius: 3, padding: 6, borderLeft: `3px solid ${NATION_COLORS[nation]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: NATION_COLORS[nation] }}>{nation}</span>
            {!err && (
              <span style={{
                fontSize: 8, padding: '1px 4px', borderRadius: 2, letterSpacing: 0.5,
                background: res.source === 'gemini' ? '#2a4a2a' : '#3a3a2a',
                color: res.source === 'gemini' ? '#8fdc8f' : '#c8b060',
              }}>{res.source === 'gemini' ? 'GEMINI' : 'HEURISTIC'}</span>
            )}
          </div>
          {err
            ? <div style={{ fontSize: 10, color: '#e05050' }}>{err}</div>
            : <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{res.reasoning}</div>}
          {res.moves.map((m, i) => (
            <div key={i} style={{ fontSize: 10, color: '#bbb' }}>
              {m.count}× {UNIT_TYPES[m.unit]?.nameFI ?? m.unit}: {zoneName(m.from)} → {zoneName(m.to)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function intelBtn(owned: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '4px 0', borderRadius: 3, fontSize: 10,
    background: owned ? '#1a3a1a' : '#1a1a1a',
    border: `1px solid ${owned ? '#3a6b3a' : '#333'}`,
    color: owned ? '#7acd7a' : '#aaa',
    cursor: owned ? 'default' : 'pointer',
  }
}

const selStyle: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #333', borderRadius: 3,
  color: '#ddd', padding: '5px 8px', fontSize: 11, width: '100%',
}
