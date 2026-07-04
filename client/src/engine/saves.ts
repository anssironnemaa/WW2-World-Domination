// Saved wars — persisted to localStorage so a game can be continued later.
import type { GameState } from '../data/types'

const KEY = 'ww2_saved_wars'

export type SaveMeta = { id: string; name: string; savedAt: number; round: number }
type SaveEntry = SaveMeta & { state: GameState }

function readAll(): SaveEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SaveEntry[]) : []
  } catch { return [] }
}

function writeAll(entries: SaveEntry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(entries)) } catch { /* quota / private mode */ }
}

export function listSaves(): SaveMeta[] {
  return readAll()
    .map(({ id, name, savedAt, round }) => ({ id, name, savedAt, round }))
    .sort((a, b) => b.savedAt - a.savedAt)
}

// Upsert by (case-insensitive) name so re-saving a war overwrites it.
export function writeSave(name: string, state: GameState): SaveMeta {
  const id = name.trim().toLowerCase()
  const entry: SaveEntry = { id, name: name.trim(), savedAt: Date.now(), round: state.round, state }
  const entries = readAll().filter(e => e.id !== id)
  entries.push(entry)
  writeAll(entries)
  return { id: entry.id, name: entry.name, savedAt: entry.savedAt, round: entry.round }
}

export function readSave(id: string): GameState | null {
  return readAll().find(e => e.id === id)?.state ?? null
}

export function deleteSave(id: string): void {
  writeAll(readAll().filter(e => e.id !== id))
}

// ── Export / import to a portable .json file ─────────────────────────────────
const EXPORT_TAG = 'ww2-world-dominance-save'

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const safeName = (name: string) => name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'war'

// Export a given game state (e.g. the current war) to a downloaded file.
export function exportState(name: string, state: GameState): void {
  const payload = { tag: EXPORT_TAG, name: name.trim(), savedAt: Date.now(), round: state.round, state }
  download(`ww2-${safeName(name)}.json`, JSON.stringify(payload, null, 2))
}

// Export an existing save entry by id.
export function exportSave(id: string): void {
  const entry = readAll().find(e => e.id === id)
  if (entry) exportState(entry.name, entry.state)
}

// Import a .json save file → adds it to the saved wars. Returns the new meta.
export async function importSaveFile(file: File): Promise<SaveMeta | null> {
  try {
    const data = JSON.parse(await file.text())
    const state: GameState | undefined = data?.state ?? (data?.territories ? data : undefined)
    if (!state || typeof state.round !== 'number' || !state.territories || !state.players) return null
    const name = (data?.name ?? state.name ?? 'Imported War').toString()
    return writeSave(name, state)
  } catch {
    return null
  }
}
