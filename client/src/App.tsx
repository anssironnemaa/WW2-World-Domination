import { MapView } from './components/map/MapView'
import { Lobby } from './components/lobby/Lobby'
import { useGameStore } from './store/gameStore'
import './index.css'

export default function App() {
  const game = useGameStore(s => s.game)

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0d12' }}>
      {game ? <MapView /> : <Lobby />}
    </div>
  )
}
