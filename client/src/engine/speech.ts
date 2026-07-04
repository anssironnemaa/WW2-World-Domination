// Narration. Prefers Gemini neural TTS (natural, human) via /api/tts; falls back
// to the browser's Web Speech API when no key/audio is available.

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined')
}

let currentAudio: HTMLAudioElement | null = null
let token = 0   // guards against stale audio arriving after Stop / a new request

// ── Gemini neural TTS path ────────────────────────────────────────────────────
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Wrap raw signed-16-bit mono PCM in a WAV container so <audio> can play it.
function pcmToWav(pcm: Uint8Array, sampleRate: number): Blob {
  const dataSize = pcm.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); str(8, 'WAVE')
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, dataSize, true)
  new Uint8Array(buffer, 44).set(pcm)
  return new Blob([buffer], { type: 'audio/wav' })
}

async function speakCloud(text: string, myToken: number, onEnd?: () => void): Promise<boolean> {
  const res = await fetch('/api/tts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
  })
  if (!res.ok) return false
  const { audio, mime } = await res.json() as { audio: string | null; mime: string }
  if (!audio || myToken !== token) return !!audio && myToken !== token // stale → treat as handled
  const rate = Number(/rate=(\d+)/.exec(mime ?? '')?.[1]) || 24000
  const url = URL.createObjectURL(pcmToWav(base64ToBytes(audio), rate))
  const el = new Audio(url)
  currentAudio = el
  el.onended = () => { URL.revokeObjectURL(url); if (currentAudio === el) currentAudio = null; onEnd?.() }
  await el.play()
  return true
}

// ── Web Speech fallback ───────────────────────────────────────────────────────
function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  return (
    voices.find(v => /en[-_]?GB/i.test(v.lang) && /(daniel|george|arthur|male)/i.test(v.name)) ||
    voices.find(v => /(enhanced|premium|neural)/i.test(v.name) && /^en/i.test(v.lang)) ||
    voices.find(v => /en[-_]?GB/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang)) || voices[0]
  )
}

function webSpeak(text: string, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) { onEnd?.(); return }
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9; u.pitch = 0.85; u.volume = 1
  const v = pickVoice(); if (v) u.voice = v
  if (onEnd) u.onend = () => onEnd()
  window.speechSynthesis.speak(u)
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function speak(text: string, onEnd?: () => void): Promise<void> {
  if (!text.trim()) { onEnd?.(); return }
  stopSpeaking()
  const myToken = ++token
  try {
    const played = await speakCloud(text, myToken, onEnd)
    if (played || myToken !== token) return
  } catch { /* fall through to browser voice */ }
  if (myToken === token) webSpeak(text, onEnd)
}

export function stopSpeaking(): void {
  token++   // invalidate any in-flight cloud request
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
