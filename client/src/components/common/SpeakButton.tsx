import { useEffect, useState } from 'react'
import { speak, stopSpeaking, speechSupported } from '../../engine/speech'

// A play/stop toggle that reads text aloud (Gemini neural voice, browser fallback).
export function SpeakButton({ text, label = '🔊 READ ALOUD', style }: { text: string; label?: string; style?: React.CSSProperties }) {
  const [speaking, setSpeaking] = useState(false)
  const [preparing, setPreparing] = useState(false)
  useEffect(() => () => stopSpeaking(), [])
  if (!speechSupported()) return null

  const active = speaking || preparing
  const toggle = async () => {
    if (active) { stopSpeaking(); setSpeaking(false); setPreparing(false); return }
    setPreparing(true)
    await speak(text, () => setSpeaking(false))
    setPreparing(false); setSpeaking(true)
  }
  return (
    <button onClick={toggle} style={{
      padding: '5px 12px', borderRadius: 4, border: `1px solid ${active ? '#e05050' : '#3a5b7a'}`,
      background: active ? 'rgba(224,80,80,0.15)' : 'rgba(58,91,122,0.2)', color: active ? '#e08a8a' : '#8ab4d8',
      fontSize: 11, fontWeight: 'bold', letterSpacing: 1, cursor: 'pointer', ...style,
    }}>
      {preparing ? '⏳ PREPARING…' : speaking ? '⏹ STOP BROADCAST' : label}
    </button>
  )
}
