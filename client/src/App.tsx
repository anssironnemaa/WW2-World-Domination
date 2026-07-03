import { useEffect } from 'react'
import { MapView } from './components/map/MapView'
import { useGameStore } from './store/gameStore'
import type { Nation, PlayerType } from './data/types'
import './index.css'

const DEFAULT_CONFIG: Record<Nation, { type: PlayerType; pin: string }> = {
  Germany:  { type: 'human', pin: '1111' },
  USSR:     { type: 'human', pin: '2222' },
  UK:       { type: 'human', pin: '3333' },
  USA:      { type: 'human', pin: '4444' },
  Japan:    { type: 'human', pin: '5555' },
  France:   { type: 'ai',    pin: '6666' },
  Italy:    { type: 'ai',    pin: '7777' },
  Neutral:  { type: 'npn',   pin: '0000' },
  None:     { type: 'npn',   pin: '0000' },
}

export default function App() {
  const initGame = useGameStore(s => s.initGame)
  const game = useGameStore(s => s.game)

  useEffect(() => {
    initGame(DEFAULT_CONFIG)
  }, [])

  if (!game) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ccc' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a4a6a' }}>
      <MapView />
    </div>
  )
}
