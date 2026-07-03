import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './store/gameStore'

// Dev-only: expose the store for debugging in the browser console.
if (import.meta.env.DEV) {
  ;(window as unknown as { useGameStore: typeof useGameStore }).useGameStore = useGameStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
