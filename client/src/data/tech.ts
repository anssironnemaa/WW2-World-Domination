// Technology tree — 4 branches, 3 levels each, 10 IPC per level (from the rulebook).
import type { TechLevels } from './types'
import { UNIT_TYPES } from './units'

export type TechBranch = keyof TechLevels // 'land' | 'air' | 'naval' | 'industry'

export const TECH_COST = 10

export type TechBranchDef = {
  key: TechBranch
  name: string
  icon: string
  levels: string[] // description of what each level (1..3) unlocks
}

export const TECH_TREE: TechBranchDef[] = [
  {
    key: 'land', name: 'Land Doctrine', icon: '🎖️',
    levels: [
      'Mechanized infantry keep pace with tanks (move 2)',
      'Heavy tanks: +1 attack/defence on the first round',
      'Blitz: tanks may advance through enemy territory',
    ],
  },
  {
    key: 'air', name: 'Air Power', icon: '✈️',
    levels: [
      'Radar & long range: aircraft +1 movement',
      'Interceptors: defending fighters fire a first-strike volley',
      'Strategic bombing +2 factory damage',
    ],
  },
  {
    key: 'naval', name: 'Naval Warfare', icon: '⚓',
    levels: [
      'Convoy escorts negate enemy submarine blockades',
      'Advanced submarines strike on a 3 (attack 3)',
      'Sonar & heavy carriers survive a second hit',
    ],
  },
  {
    key: 'industry', name: 'War Industry', icon: '🏭',
    levels: [
      'Factory output +2 units of capacity',
      'Cheap manpower: infantry & partisans cost −1 IPC',
      'Secret weapons programme (raises victory requirement)',
    ],
  },
]

// War-industry effects on purchasing.
export function unitCostWithTech(uid: string, tech: TechLevels): number {
  const base = UNIT_TYPES[uid]?.cost ?? 0
  if (tech.industry >= 2 && (uid === 'infantry' || uid === 'partisan')) return Math.max(1, base - 1)
  return base
}

export function factoryCapacityBonus(tech: TechLevels): number {
  return tech.industry >= 1 ? 2 : 0
}
