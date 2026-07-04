import { useMemo } from 'react'
import { useGameStore, NATION_COLORS } from '../../store/gameStore'
import { roundToDate } from '../../data/calendar'
import type { Nation, NationStat, RoundSnapshot } from '../../data/types'

const NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

type Metric = { key: keyof NationStat; label: string; hint: string }
const METRICS: Metric[] = [
  { key: 'ipc', label: 'Treasury (IPC)', hint: 'War chest available to spend' },
  { key: 'income', label: 'Production / round', hint: 'Territory income each round' },
  { key: 'territories', label: 'Territories held', hint: 'Land controlled' },
  { key: 'vcs', label: 'Victory Cities', hint: 'Progress to victory (7 solo / 9 allied)' },
  { key: 'units', label: 'Army size', hint: 'Total units on the map' },
  { key: 'losses', label: 'Losses / round', hint: 'Units destroyed in battle' },
]

export function StatsPanel({ onClose }: { onClose: () => void }) {
  const game = useGameStore(s => s.game)!
  const history = game.history

  // Current live standings (from the map right now, not just snapshots)
  const current = useMemo(() => computeCurrent(game), [game])

  const insights = useMemo(() => deriveInsights(history, current), [history, current])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(6,8,12,0.96)',
      display: 'flex', flexDirection: 'column', color: '#e8e8d8', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #222' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#fff' }}>📊 WAR STATISTICS</div>
          <div style={{ fontSize: 11, color: '#8a9bb0', letterSpacing: 1 }}>{roundToDate(game.round).long.toUpperCase()} · {history.length} ROUND{history.length === 1 ? '' : 'S'} RECORDED</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #444', borderRadius: 4, color: '#ccc',
          padding: '6px 14px', cursor: 'pointer', fontSize: 12,
        }}>✕ CLOSE</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
        {/* Standings strip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {[...NATIONS].sort((a, b) => current[b].vcs - current[a].vcs || current[b].ipc - current[a].ipc).map((n, i) => (
            <div key={n} style={{
              flex: '1 1 120px', minWidth: 120, padding: '10px 12px', borderRadius: 6,
              background: 'rgba(255,255,255,0.03)', borderTop: `3px solid ${NATION_COLORS[n]}`, border: '1px solid #222', borderTopWidth: 3,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>{n === 'USSR' ? 'SOVIET' : n.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: '#667' }}>#{i + 1}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, color: '#aab' }}>
                <span><b style={{ color: '#ffe066' }}>{current[n].vcs}</b> VC</span>
                <span><b style={{ color: '#fff' }}>{current[n].ipc}</b> IPC</span>
                <span><b style={{ color: '#fff' }}>{current[n].units}</b> u</span>
              </div>
            </div>
          ))}
        </div>

        {history.length < 1 ? (
          <div style={{ color: '#667', fontSize: 12, fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
            No completed rounds yet — statistics appear after the first income phase.
          </div>
        ) : (
          <>
            {/* Insight callouts */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{
                  flex: '1 1 200px', padding: '10px 14px', borderRadius: 6, background: 'rgba(200,168,48,0.08)',
                  border: '1px solid #3a3320',
                }}>
                  <div style={{ fontSize: 10, color: '#c8a830', letterSpacing: 1, marginBottom: 3 }}>{ins.title}</div>
                  <div style={{ fontSize: 12, color: '#ddd' }}>{ins.body}</div>
                </div>
              ))}
            </div>

            {/* Metric charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {METRICS.map(m => <Chart key={m.key} metric={m} history={history} />)}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, justifyContent: 'center' }}>
              {NATIONS.map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#aab' }}>
                  <span style={{ width: 12, height: 3, background: NATION_COLORS[n], display: 'inline-block', borderRadius: 2 }} />
                  {n === 'USSR' ? 'Soviet Union' : n}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── One line chart, all nations ───────────────────────────────────────────────
function Chart({ metric, history }: { metric: Metric; history: RoundSnapshot[] }) {
  const W = 320, H = 150, padL = 30, padR = 10, padT = 12, padB = 20
  const xs = history.map(h => h.round)
  const minR = Math.min(...xs), maxR = Math.max(...xs)
  let maxV = 0
  for (const snap of history) for (const n of NATIONS) maxV = Math.max(maxV, snap.perNation[n]?.[metric.key] ?? 0)
  maxV = Math.max(1, maxV)

  const px = (r: number) => padL + (maxR === minR ? 0.5 : (r - minR) / (maxR - minR)) * (W - padL - padR)
  const py = (v: number) => H - padB - (v / maxV) * (H - padT - padB)

  const yTicks = [0, Math.round(maxV / 2), maxV]

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #222', borderRadius: 6, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>{metric.label}</div>
      <div style={{ fontSize: 10, color: '#667', marginBottom: 4 }}>{metric.hint}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* gridlines + y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={py(v)} x2={W - padR} y2={py(v)} stroke="#222" strokeWidth={1} />
            <text x={padL - 4} y={py(v) + 3} textAnchor="end" fontSize={8} fill="#667">{v}</text>
          </g>
        ))}
        {/* x labels (first / last date) */}
        <text x={px(minR)} y={H - 6} textAnchor="start" fontSize={8} fill="#667">{roundToDate(minR).short}</text>
        {maxR !== minR && <text x={px(maxR)} y={H - 6} textAnchor="end" fontSize={8} fill="#667">{roundToDate(maxR).short}</text>}
        {/* nation lines */}
        {NATIONS.map(n => {
          const pts = history.map(h => `${px(h.round).toFixed(1)},${py(h.perNation[n]?.[metric.key] ?? 0).toFixed(1)}`)
          if (pts.length === 1) {
            const [x, y] = pts[0].split(',').map(Number)
            return <circle key={n} cx={x} cy={y} r={2.5} fill={NATION_COLORS[n]} />
          }
          return <polyline key={n} points={pts.join(' ')} fill="none" stroke={NATION_COLORS[n]} strokeWidth={1.8} opacity={0.9} />
        })}
      </svg>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeCurrent(game: ReturnType<typeof useGameStore.getState>['game']): Record<Nation, NationStat> {
  const out = {} as Record<Nation, NationStat>
  const allZones = game ? [...Object.values(game.territories), ...Object.values(game.seaZones)] : []
  for (const n of NATIONS) {
    let territories = 0, vcs = 0, units = 0
    if (game) {
      for (const t of Object.values(game.territories)) {
        if (t.owner === n) { territories++; if (t.isVC) vcs++ }
      }
      for (const z of allZones) {
        const u = z.units[n]
        if (u) units += Object.values(u).reduce((s, c) => s + c, 0)
      }
    }
    out[n] = { ipc: game?.players[n]?.ipc ?? 0, income: 0, territories, vcs, units, losses: 0 }
  }
  return out
}

function deriveInsights(history: RoundSnapshot[], current: Record<Nation, NationStat>): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = []
  // Leader
  const leader = [...NATIONS].sort((a, b) => current[b].vcs - current[a].vcs || current[b].ipc - current[a].ipc)[0]
  out.push({ title: 'FRONT-RUNNER', body: `${nm(leader)} leads with ${current[leader].vcs} Victory Cities and ${current[leader].ipc} IPC in the treasury.` })

  if (history.length >= 2) {
    const first = history[0], last = history[history.length - 1]
    // Biggest territorial gain
    let gainer: Nation = 'Germany', gain = -Infinity
    for (const n of NATIONS) {
      const d = (last.perNation[n]?.territories ?? 0) - (first.perNation[n]?.territories ?? 0)
      if (d > gain) { gain = d; gainer = n }
    }
    if (gain > 0) out.push({ title: 'RISING POWER', body: `${nm(gainer)} has expanded by ${gain} territor${gain === 1 ? 'y' : 'ies'} since ${roundToDate(first.round).short}.` })
    // Bloodiest
    let bloody: Nation = 'Germany', losses = -1
    for (const n of NATIONS) {
      const total = history.reduce((s, h) => s + (h.perNation[n]?.losses ?? 0), 0)
      if (total > losses) { losses = total; bloody = n }
    }
    if (losses > 0) out.push({ title: 'HEAVIEST TOLL', body: `${nm(bloody)} has lost ${losses} units in battle so far — the bloodiest campaign.` })
  }
  return out
}

const nm = (n: Nation) => (n === 'USSR' ? 'The Soviet Union' : n)
