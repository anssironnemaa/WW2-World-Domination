// Neural text-to-speech via Gemini. Produces far more natural, human narration
// than the browser's built-in voices. Returns base64 PCM audio; the client wraps
// it in a WAV container and plays it. Falls back (client-side) to the Web Speech
// API when no key is configured.

export type TtsRequest = { text: string; voice?: string }
export type TtsResult = { audio: string | null; mime: string }

// A measured, authoritative voice suits the wartime-newsreel tone.
const DEFAULT_VOICE = 'Charon'

export async function runTts(req: TtsRequest, apiKey?: string): Promise<TtsResult> {
  const text = (req?.text ?? '').trim()
  if (!apiKey || !text) return { audio: null, mime: '' }
  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey })
    const styled = `Read the following as a measured, authoritative 1940s wartime radio newsreel broadcast — clear, resonant and human, with natural pacing:\n\n${text}`
    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: styled,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: req.voice || DEFAULT_VOICE } } },
      },
    } as never)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (resp as any)?.candidates?.[0]?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inline = parts.map((p: any) => p?.inlineData).find((d: any) => d?.data)
    if (!inline?.data) return { audio: null, mime: '' }
    return { audio: inline.data as string, mime: (inline.mimeType as string) || 'audio/L16;rate=24000' }
  } catch {
    return { audio: null, mime: '' }
  }
}
