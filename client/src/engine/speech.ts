// WW2 radio-newsreel style narration via the browser's Web Speech API (free,
// no backend). Used to read AI war summaries and bulletins aloud for the room.

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  // Prefer a deep English (British) male voice for the period feel.
  return (
    voices.find(v => /en[-_]?GB/i.test(v.lang) && /(daniel|george|arthur|male)/i.test(v.name)) ||
    voices.find(v => /en[-_]?GB/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang)) ||
    voices[0]
  )
}

export function speak(text: string, onEnd?: () => void): void {
  if (!speechSupported() || !text.trim()) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9      // measured, newsreel cadence
  u.pitch = 0.8     // lower, gravelly
  u.volume = 1
  const v = pickVoice()
  if (v) u.voice = v
  if (onEnd) u.onend = () => onEnd()
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}
