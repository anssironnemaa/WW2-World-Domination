import { useEffect, useState } from 'react'
import { speak, stopSpeaking, speechSupported } from '../../engine/speech'

// A play/stop toggle that reads text aloud in the newsreel voice.
export function SpeakButton({ text, label = '🔊 READ ALOUD', style }: { text: string; label?: string; style?: React.CSSProperties }) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => stopSpeaking(), [])
  if (!speechSupported()) return null

  const toggle = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false) }
    else { setSpeaking(true); speak(text, () => setSpeaking(false)) }
  }
  return (
    <button onClick={toggle} style={{
      padding: '5px 12px', borderRadius: 4, border: `1px solid ${speaking ? '#e05050' : '#3a5b7a'}`,
      background: speaking ? 'rgba(224,80,80,0.15)' : 'rgba(58,91,122,0.2)', color: speaking ? '#e08a8a' : '#8ab4d8',
      fontSize: 11, fontWeight: 'bold', letterSpacing: 1, cursor: 'pointer', ...style,
    }}>
      {speaking ? '⏹ STOP BROADCAST' : label}
    </button>
  )
}
