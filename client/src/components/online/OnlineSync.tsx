import { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { mp } from '../../engine/online'
import { roundToDate } from '../../data/calendar'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Drives online sync. Mounted once at the app root; no-ops unless a session is
// active. The HOST drains remote players' actions, applies them through the real
// engine, and republishes per-nation views. A GUEST polls its own view.
export function OnlineSync() {
  const online = useGameStore(s => s.online)

  useEffect(() => {
    if (!online) return
    let stop = false

    const hostLoop = async () => {
      while (!stop) {
        try {
          const { actions } = await mp.pull(online.code, online.hostToken!)
          if (actions?.length) {
            const st = useGameStore.getState()
            for (const a of actions) st.applyRemoteAction(a.nation, a.action)
          }
        } catch { /* transient network error — retry next tick */ }
        const g = useGameStore.getState().game
        if (g) { try { await mp.publish(online.code, online.hostToken!, g, roundToDate(g.round).long) } catch { /* retry */ } }
        await sleep(1500)
      }
    }

    const guestLoop = async () => {
      while (!stop) {
        try {
          const { state } = await mp.view(online.code, online.nation, online.pin)
          if (state) useGameStore.getState().setGameFromView(state)
        } catch { /* retry next tick */ }
        await sleep(2000)
      }
    }

    if (online.role === 'host') hostLoop(); else guestLoop()
    return () => { stop = true }
  }, [online])

  return null
}
