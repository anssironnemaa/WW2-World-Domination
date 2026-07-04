import { useState, useMemo } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { UNIT_TYPES, unitName } from '../../data/units'
import { ADJACENCY, ZONE_KIND } from '../../data/adjacency'
import type { Nation, UnitType } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

const NATION_LABELS: Record<string, string> = {
  Germany: 'Germany', USSR: 'Soviet Union', UK: 'Britain',
  USA: 'United States', Japan: 'Japan', France: 'France', Italy: 'Italy',
}

const CATEGORY_LABELS: Record<string, string> = {
  infantry: 'Infantry',
  armor: 'Armor',
  air: 'Air Force',
  navy: 'Navy',
}

type Cart = Record<string, number>  // unitId -> count

type Props = {
  nation: Nation
  onClose: () => void
}

export function PurchasePhase({ nation, onClose }: Props) {
  const game = useGameStore(s => s.game)
  const confirmPurchase = useGameStore(s => s.confirmPurchase)
  const buildFactory = useGameStore(s => s.buildFactory)
  const [cart, setCart] = useState<Cart>({})
  const [selectedFactory, setSelectedFactory] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState('')
  const [buildZone, setBuildZone] = useState('')
  const [buildError, setBuildError] = useState('')
  const [navalSea, setNavalSea] = useState('')

  const player = game?.players[nation]
  const color = NATION_COLORS[nation]

  // Factories owned by this nation
  const factories = useMemo(() => {
    if (!game) return []
    return Object.values(game.territories).filter(
      t => t.owner === nation && t.hasFactory
    )
  }, [game, nation])

  // Cart totals
  const cartCost = useMemo(() =>
    Object.entries(cart).reduce((sum, [uid, count]) => sum + (UNIT_TYPES[uid]?.cost ?? 0) * count, 0)
  , [cart])

  const cartCount = useMemo(() =>
    Object.values(cart).reduce((sum, n) => sum + n, 0)
  , [cart])

  const budget = player?.ipc ?? 0
  const remaining = budget - cartCost

  // Factory construction: owned territories without a factory; lifetime cap of 2.
  const FACTORY_COST = 15, MAX_FACTORIES = 2
  const factoriesBuilt = player?.factoriesBuilt ?? 0
  const buildableZones = useMemo(() => {
    if (!game) return []
    return Object.values(game.territories).filter(t => t.owner === nation && !t.hasFactory)
  }, [game, nation])
  const canBuildFactory = factoriesBuilt < MAX_FACTORIES && buildableZones.length > 0 && budget >= FACTORY_COST

  // Naval production: ships must be built at a coastal factory and launch into
  // an adjacent sea zone. Track whether the cart has navy and which seas the
  // chosen factory can reach.
  const cartHasNavy = useMemo(() =>
    Object.entries(cart).some(([uid, n]) => n > 0 && UNIT_TYPES[uid]?.category === 'navy')
  , [cart])
  const factorySeas = useMemo(() => {
    if (!selectedFactory || !game) return [] as { id: string; name: string }[]
    return (ADJACENCY[selectedFactory] ?? [])
      .filter(z => ZONE_KIND[z] === 'sea')
      .map(z => ({ id: z, name: game.seaZones[z]?.nameEN ?? z }))
  }, [selectedFactory, game])
  const factoryIsCoastal = factorySeas.length > 0
  const navalReady = !cartHasNavy || (factoryIsCoastal && !!navalSea)

  const canAfford = (unit: UnitType) => remaining >= unit.cost
  const add = (uid: string) => setCart(c => ({ ...c, [uid]: (c[uid] ?? 0) + 1 }))
  const remove = (uid: string) => setCart(c => {
    const next = { ...c, [uid]: (c[uid] ?? 1) - 1 }
    if (next[uid] <= 0) delete next[uid]
    return next
  })

  const unitsByCategory = useMemo(() => {
    const grouped: Record<string, UnitType[]> = {}
    Object.values(UNIT_TYPES).forEach(u => {
      if (!grouped[u.category]) grouped[u.category] = []
      grouped[u.category].push(u)
    })
    return grouped
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#0f1a24',
        border: `2px solid ${color}`,
        borderRadius: 10,
        width: 700,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 0 40px ${color}44`,
      }}>
        {/* Header */}
        <div style={{
          background: color + '22',
          borderBottom: `1px solid ${color}44`,
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
              Purchase — {NATION_LABELS[nation] ?? nation}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
              Choose units and a factory
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #858585', borderRadius: 4,
            color: '#aaa', cursor: 'pointer', padding: '4px 12px', fontSize: 13,
          }}>✕ Close</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Unit shop — left panel */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', borderRight: '1px solid #222' }}>
            {(['infantry', 'armor', 'air', 'navy'] as const).map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#a2a2a2', fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {(unitsByCategory[cat] ?? []).map(unit => {
                  const inCart = cart[unit.id] ?? 0
                  const affordable = canAfford(unit)
                  return (
                    <div key={unit.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      marginBottom: 4,
                      borderRadius: 5,
                      background: inCart > 0 ? color + '18' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${inCart > 0 ? color + '55' : '#333'}`,
                      opacity: affordable || inCart > 0 ? 1 : 0.45,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#fff', fontWeight: inCart > 0 ? 'bold' : 'normal' }}>
                          {unitName(unit.id)}
                        </div>
                        <div style={{ fontSize: 10, color: '#a2a2a2', marginTop: 2 }}>
                          Atk {unit.attack} · Def {unit.defend} · Move {unit.move} · {unit.buildTime}mo build
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: '#ffe066', fontWeight: 'bold', minWidth: 36, textAlign: 'right' }}>
                        {unit.cost} IPC
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => remove(unit.id)}
                          disabled={inCart === 0}
                          style={btnStyle('#c0392b', inCart === 0)}
                        >−</button>
                        <span style={{ minWidth: 20, textAlign: 'center', color: inCart > 0 ? '#ffe066' : '#858585', fontWeight: 'bold', fontSize: 14 }}>
                          {inCart || ''}
                        </span>
                        <button
                          onClick={() => add(unit.id)}
                          disabled={!affordable}
                          style={btnStyle(color, !affordable)}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Right panel — budget + factory + cart */}
          <div style={{ width: 220, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Budget */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 6,
              padding: 12,
              border: '1px solid #333',
            }}>
              <div style={{ fontSize: 11, color: '#a2a2a2', marginBottom: 6 }}>BUDGET</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ffe066' }}>{budget} IPC</div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#aaa' }}>Spent:</span>
                <span style={{ color: '#e08a8a' }}>−{cartCost} IPC</span>
              </div>
              <div style={{
                marginTop: 4, padding: '4px 0', borderTop: '1px solid #333',
                display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 'bold',
              }}>
                <span style={{ color: '#aaa' }}>Remaining:</span>
                <span style={{ color: remaining < 0 ? '#e05050' : '#7acd7a' }}>{remaining} IPC</span>
              </div>
            </div>

            {/* Factory selector */}
            <div>
              <div style={{ fontSize: 11, color: '#a2a2a2', marginBottom: 6 }}>TARGET FACTORY</div>
              {factories.length === 0 ? (
                <div style={{ fontSize: 12, color: '#858585', fontStyle: 'italic' }}>No factories</div>
              ) : (
                factories.map(f => {
                  const cap = f.ipc - f.factoryDamage
                  const selected = selectedFactory === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFactory(selected ? null : f.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '6px 10px', marginBottom: 4, borderRadius: 5,
                        background: selected ? color + '33' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selected ? color : '#444'}`,
                        cursor: 'pointer', color: '#ddd', fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{f.nameFI}</div>
                      <div style={{ fontSize: 11, color: '#a2a2a2' }}>Capacity: {cap} units</div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Naval delivery — where the ships launch (only when buying navy) */}
            {cartHasNavy && (
              <div>
                <div style={{ fontSize: 11, color: '#a2a2a2', marginBottom: 6 }}>🚢 LAUNCH NAVY INTO</div>
                {!selectedFactory ? (
                  <div style={{ fontSize: 12, color: '#e0b060', fontStyle: 'italic' }}>Pick a factory first.</div>
                ) : !factoryIsCoastal ? (
                  <div style={{ fontSize: 12, color: '#e05050' }}>That factory is inland — it can't build ships. Choose a coastal factory.</div>
                ) : (
                  <select value={navalSea} onChange={e => setNavalSea(e.target.value)}
                    style={{ width: '100%', background: '#0f141a', border: '1px solid #444', borderRadius: 5, color: '#ddd', fontSize: 12, padding: '6px 8px' }}>
                    <option value="">Choose a sea zone…</option>
                    {factorySeas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Build a new factory (max 2 per war, on a factory-less owned zone) */}
            <div>
              <div style={{ fontSize: 11, color: '#a2a2a2', marginBottom: 6 }}>
                BUILD FACTORY <span style={{ color: '#8a96aa' }}>· {FACTORY_COST} IPC · {MAX_FACTORIES - factoriesBuilt} of {MAX_FACTORIES} left</span>
              </div>
              {factoriesBuilt >= MAX_FACTORIES ? (
                <div style={{ fontSize: 12, color: '#858585', fontStyle: 'italic' }}>Factory limit reached.</div>
              ) : buildableZones.length === 0 ? (
                <div style={{ fontSize: 12, color: '#858585', fontStyle: 'italic' }}>No factory-less territory you own.</div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={buildZone} onChange={e => { setBuildZone(e.target.value); setBuildError('') }}
                    style={{ flex: 1, background: '#0f141a', border: '1px solid #444', borderRadius: 5, color: '#ddd', fontSize: 12, padding: '6px 8px' }}>
                    <option value="">Choose a territory…</option>
                    {buildableZones.map(z => <option key={z.id} value={z.id}>{z.nameEN} ({z.ipc} IPC)</option>)}
                  </select>
                  <button
                    disabled={!buildZone || !canBuildFactory}
                    onClick={() => {
                      const err = buildFactory(nation, buildZone)
                      setBuildError(err ?? '')
                      if (!err) setBuildZone('')
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 5, border: 'none', fontWeight: 'bold', fontSize: 11,
                      background: buildZone && canBuildFactory ? '#6a5a20' : '#333',
                      color: buildZone && canBuildFactory ? '#ffe066' : '#8f8f8f',
                      cursor: buildZone && canBuildFactory ? 'pointer' : 'not-allowed',
                    }}
                  >⚙ BUILD</button>
                </div>
              )}
              {buildError && <div style={{ color: '#e05050', fontSize: 11, marginTop: 4 }}>{buildError}</div>}
            </div>

            {/* Cart summary */}
            {cartCount > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#a2a2a2', marginBottom: 6 }}>CART</div>
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  padding: 10,
                  border: '1px solid #333',
                }}>
                  {Object.entries(cart).map(([uid, count]) => {
                    const u = UNIT_TYPES[uid]
                    return (
                      <div key={uid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, color: '#ccc' }}>
                        <span>{count}× {unitName(uid)}</span>
                        <span style={{ color: '#ffe066' }}>{(u?.cost ?? 0) * count}</span>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid #333', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}>
                    <span style={{ color: '#aaa' }}>Total</span>
                    <span style={{ color: '#ffe066' }}>{cartCost} IPC</span>
                  </div>
                </div>
              </div>
            )}

            {purchaseError && (
              <div style={{ color: '#e05050', fontSize: 12 }}>{purchaseError}</div>
            )}

            {/* Confirm button */}
            {(() => {
              const ready = cartCount > 0 && !!selectedFactory && remaining >= 0 && navalReady
              return (
                <button
                  disabled={!ready}
                  onClick={() => {
                    const err = confirmPurchase(nation, cart, selectedFactory!, navalSea || undefined)
                    if (err) setPurchaseError(err)
                    else onClose()
                  }}
                  style={{
                    marginTop: 'auto', padding: '10px 0', borderRadius: 6,
                    background: ready ? color : '#333', color: '#fff', border: 'none',
                    cursor: ready ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: 14,
                    opacity: ready ? 1 : 0.5,
                  }}
                >
                  {cartHasNavy && !navalReady ? '⚓ CHOOSE A SEA ZONE FOR THE SHIPS' : '✓ CONFIRM PURCHASE'}
                </button>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function btnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    width: 24, height: 24, borderRadius: 4,
    background: disabled ? '#222' : color + '33',
    border: `1px solid ${disabled ? '#444' : color}`,
    color: disabled ? '#858585' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 16, lineHeight: '22px', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

// Wrapper to open PurchasePhase from the map
export function PurchaseButton({ compact }: { compact?: boolean }) {
  const [activeNation, setActiveNation] = useState<Nation | null>(null)
  const [open, setOpen] = useState(false)
  const game = useGameStore(s => s.game)
  if (!game) return null

  const humanNations = NATIONS.filter(n => game.players[n]?.type === 'human')

  return (
    <>
      {compact ? (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
              background: '#c8a830', border: 'none', color: '#0d0d0d',
              cursor: 'pointer', letterSpacing: 1,
            }}
          >
            🛒 PURCHASE
          </button>
          {open && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: '#111', border: '1px solid #333', borderRadius: 4,
              padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160,
              zIndex: 50,
            }}>
              {humanNations.map(nation => (
                <button
                  key={nation}
                  onClick={() => { setActiveNation(nation); setOpen(false) }}
                  style={{
                    padding: '5px 10px', borderRadius: 3, fontSize: 11, textAlign: 'left',
                    background: NATION_COLORS[nation] + '22',
                    border: `1px solid ${NATION_COLORS[nation]}55`,
                    color: '#ddd', cursor: 'pointer',
                  }}
                >
                  {NATION_LABELS[nation] ?? nation}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, padding: '6px 8px', borderBottom: '1px solid #222', background: 'rgba(0,0,0,0.6)' }}>
          {humanNations.map(nation => (
            <button
              key={nation}
              onClick={() => setActiveNation(nation)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 12,
                background: NATION_COLORS[nation] + '33',
                border: `1px solid ${NATION_COLORS[nation]}`,
                color: '#ddd', cursor: 'pointer',
              }}
            >
              🛒 {NATION_LABELS[nation] ?? nation}
            </button>
          ))}
        </div>
      )}
      {activeNation && (
        <PurchasePhase nation={activeNation} onClose={() => setActiveNation(null)} />
      )}
    </>
  )
}
