// Core game types shared across the application

export type Nation = 'Germany' | 'USSR' | 'UK' | 'USA' | 'Japan' | 'France' | 'Italy' | 'Neutral' | 'None'

export type UnitCategory = 'infantry' | 'armor' | 'air' | 'navy'

export type UnitType = {
  id: string
  nameFI: string
  cost: number
  buildTime: number
  attack: number
  defend: number
  move: number
  category: UnitCategory
  special: string
}

export type UnitStack = {
  unit: string  // unit type id
  count: number
}

export type Territory = {
  id: string
  nameFI: string
  nameEN: string
  owner: Nation
  originalOwner: Nation
  ipc: number
  isVC: boolean
  vcName: string
  hasFactory: boolean
  hasNavalBase: boolean
  factoryCity: string
  chokepoint: string
  neutralJV: number
  region: string
  type: 'land'
  units: Partial<Record<Nation, Record<string, number>>>  // nation -> unitId -> count
  factoryDamage: number
}

export type SeaZone = {
  id: string
  tunnus: string
  nameFI: string
  nameEN: string
  chokepoint: string
  adjacentTerritories: string
  type: 'sea'
  units: Partial<Record<Nation, Record<string, number>>>
}

export type MapZone = Territory | SeaZone

export type StartingForces = Record<string, Record<string, UnitStack[]>>

export type PlayerType = 'human' | 'ai' | 'npn'

export type Player = {
  nation: Nation
  type: PlayerType
  pin: string
  ipc: number
  techLevels: TechLevels
  codeBreaking: boolean   // one-time 20 IPC purchase — d6 each round may reveal enemy orders
  encryption: boolean     // 10 IPC — counters enemy code-breaking
}

export type TechLevels = {
  land: number    // 0-3
  air: number     // 0-3
  naval: number   // 0-3
  industry: number // 0-3
}

export type ProductionQueueItem = {
  unit: string
  count: number
  factory: string  // territory id
  turnsRemaining: number
}

export type Phase =
  | 'lobby'
  | 'diplomacy'
  | 'purchase'
  | 'orders'
  | 'reveal'
  | 'battle'
  | 'income'

export type MoveOrder = {
  id: string
  nation: Nation
  from: string   // zone id (current position; advances each turn for standing orders)
  to: string     // final destination zone id
  unit: string   // unit type id
  count: number
  path?: string[]         // full route incl. endpoints
  standing?: boolean      // multi-turn march still en route
  needsTransport?: boolean
  transportZone?: string  // sea zone the crossing loads through
}

// ── Diplomacy ─────────────────────────────────────────────────────────────────
export type Alliance = {
  id: string
  parties: Nation[]
  sinceRound: number
}

export type NonAggressionPact = {
  id: string
  parties: Nation[]
  untilRound: number     // pact expires at the start of this round
}

export type MercenaryContract = {
  id: string
  ipc: number
  unit: string           // unit type id
  owner: Nation          // nation supplying the unit
  hirer: Nation          // nation paying for and commanding it
  round: number
}

export type DiplomacyLogEntry = {
  round: number
  text: string
}

export type AiDifficulty = 'easy' | 'normal' | 'hard'

// A running chronicle of significant game events, used to write the war history.
export type ChronicleEntry = {
  round: number
  kind: 'battle' | 'conquest' | 'power' | 'treaty'
  text: string
}

// Per-nation figures captured at the end of each round, for the statistics page
// and the war-room front map.
export type NationStat = {
  ipc: number
  income: number
  territories: number
  vcs: number
  units: number       // total units on the map
  losses: number      // units lost in battle this round
}

export type RoundSnapshot = {
  round: number
  perNation: Partial<Record<Nation, NationStat>>
  ownership: Record<string, Nation>   // territory id → owner, for the war-room front map
  arrows: MoveOrder[]                  // this round's movements
  battles: { zoneId: string; winner: 'attacker' | 'defender' | 'draw' }[]
  forces: Record<string, Partial<Record<Nation, number>>>  // zone → nation → total units
}

// ── Espionage ─────────────────────────────────────────────────────────────────
export type SpyOrder = {
  spy: Nation            // spending nation
  target: Nation         // nation being spied on
  points: number         // 1 point = 5 IPC
}

export type SpyReport = {
  round: number
  spy: Nation
  target: Nation
  success: boolean
  detail: string         // human-readable outcome
  revealedOrders?: MoveOrder[]
}

export type GameState = {
  name: string
  round: number
  phase: Phase
  players: Record<Nation, Player>
  territories: Record<string, Territory>
  seaZones: Record<string, SeaZone>
  productionQueues: Record<Nation, ProductionQueueItem[]>
  activeNation: Nation | null
  orders: Partial<Record<Nation, MoveOrder[]>>
  standingOrders: MoveOrder[]        // multi-turn marches still en route
  lockedNations: Nation[]
  battleReports: import('../engine/combat').BattleResult[]
  incomeReport: Partial<Record<Nation, number>>
  // Diplomacy
  alliances: Alliance[]
  pacts: NonAggressionPact[]
  mercenaries: MercenaryContract[]
  diplomacyLog: DiplomacyLogEntry[]
  // Espionage
  spyOrders: SpyOrder[]
  spyReports: SpyReport[]
  // Victory
  winner: Nation | null
  winningParties: Nation[]        // solo: [winner]; alliance: all members
  victoryType: 'solo' | 'alliance' | null
  // War history
  chronicle: ChronicleEntry[]
  strategicNotes: { round: number; nation: Nation; text: string }[]  // AI stated intentions
  aiDifficulty: AiDifficulty
  // Statistics — one snapshot per completed round
  history: RoundSnapshot[]
  // Last revealed movements/battles — persist on the map from reveal until the
  // next reveal replaces them (so players can study them while planning).
  revealedArrows: MoveOrder[]
  revealedBattles: { zoneId: string; winner: 'attacker' | 'defender' | 'draw' }[]
}
