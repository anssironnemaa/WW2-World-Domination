import { useState, useMemo } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { UNIT_TYPES } from '../../data/units'
import type { Nation, UnitType } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

const NATION_LABELS: Record<string, string> = {
  Germany: 'Saksa', USSR: 'Neuvostoliitto', UK: 'Iso-Britannia',
  USA: 'Yhdysvallat', Japan: 'Japani', France: 'Ranska', Italy: 'Italia',
}

const CATEGORY_LABELS: Record<string, string> = {
  infantry: 'Jalkaväki',
  armor: 'Panssarit',
  air: 'Ilmavoimat',
  navy: 'Laivasto',
}

type Cart = Record<string, number>  // unitId -> count

type Props = {
  nation: Nation
  onClose: () => void
}

export function PurchasePhase({ nation, onClose }: Props) {
  const game = useGameStore(s => s.game)
  const confirmPurchase = useGameStore(s => s.confirmPurchase)
  const [cart, setCart] = useState<Cart>({})
  const [selectedFactory, setSelectedFactory] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState('')

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
              Ostosvaihe — {NATION_LABELS[nation] ?? nation}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
              Valitse yksiköt ja kohdetehdas
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #555', borderRadius: 4,
            color: '#aaa', cursor: 'pointer', padding: '4px 12px', fontSize: 13,
          }}>✕ Sulje</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Unit shop — left panel */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', borderRight: '1px solid #222' }}>
            {(['infantry', 'armor', 'air', 'navy'] as const).map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
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
                          {unit.nameFI}
                        </div>
                        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                          H:{unit.attack} P:{unit.defend} Liike:{unit.move} · {unit.buildTime} kk
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
                        <span style={{ minWidth: 20, textAlign: 'center', color: inCart > 0 ? '#ffe066' : '#555', fontWeight: 'bold', fontSize: 14 }}>
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
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>BUDJETTI</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ffe066' }}>{budget} IPC</div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#aaa' }}>Ostettu:</span>
                <span style={{ color: '#e08a8a' }}>−{cartCost} IPC</span>
              </div>
              <div style={{
                marginTop: 4, padding: '4px 0', borderTop: '1px solid #333',
                display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 'bold',
              }}>
                <span style={{ color: '#aaa' }}>Jäljellä:</span>
                <span style={{ color: remaining < 0 ? '#e05050' : '#7acd7a' }}>{remaining} IPC</span>
              </div>
            </div>

            {/* Factory selector */}
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>KOHDETEHDAS</div>
              {factories.length === 0 ? (
                <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>Ei tehtaita</div>
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
                      <div style={{ fontSize: 11, color: '#888' }}>Kapasiteetti: {cap} yksikköä</div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Cart summary */}
            {cartCount > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>OSTOSKORI</div>
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
                        <span>{count}× {u?.nameFI ?? uid}</span>
                        <span style={{ color: '#ffe066' }}>{(u?.cost ?? 0) * count}</span>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid #333', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}>
                    <span style={{ color: '#aaa' }}>Yhteensä</span>
                    <span style={{ color: '#ffe066' }}>{cartCost} IPC</span>
                  </div>
                </div>
              </div>
            )}

            {purchaseError && (
              <div style={{ color: '#e05050', fontSize: 12 }}>{purchaseError}</div>
            )}

            {/* Confirm button */}
            <button
              disabled={cartCount === 0 || !selectedFactory || remaining < 0}
              onClick={() => {
                const err = confirmPurchase(nation, cart, selectedFactory!)
                if (err) setPurchaseError(err)
                else onClose()
              }}
              style={{
                marginTop: 'auto',
                padding: '10px 0',
                borderRadius: 6,
                background: (cartCount > 0 && selectedFactory && remaining >= 0) ? color : '#333',
                color: '#fff',
                border: 'none',
                cursor: (cartCount > 0 && selectedFactory && remaining >= 0) ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                fontSize: 14,
                opacity: (cartCount > 0 && selectedFactory && remaining >= 0) ? 1 : 0.5,
              }}
            >
              ✓ Vahvista ostokset
            </button>
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
    color: disabled ? '#555' : '#fff',
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
