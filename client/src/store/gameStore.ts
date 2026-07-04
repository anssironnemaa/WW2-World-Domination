import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { GameState, Nation, Phase, Player, PlayerType, Territory, SeaZone, MoveOrder, AiDifficulty } from '../data/types'
import { TERRITORIES, SEA_ZONES } from '../data/territories'
import { STARTING_FORCES } from '../data/starting'
import { UNIT_TYPES } from '../data/units'
import { resolveBattle, type BattleResult, type Force } from '../engine/combat'
import { parseCommand, areAllied } from '../engine/diplomacy'
import { resolveEspionage } from '../engine/espionage'
import { roundToDate } from '../data/calendar'
import { TECH_COST, unitCostWithTech } from '../data/tech'
import { evaluateMove } from '../engine/movement'
import { writeSave, readSave } from '../engine/saves'

const SPY_POINT_COST = 5
const CODE_BREAKING_COST = 20
const ENCRYPTION_COST = 10

const SOLO_VC_TARGET = 7
const ALLIANCE_VC_TARGET = 9

// Home capital (VC territory) per nation — must be held for an alliance victory.
const CAPITALS: Partial<Record<Nation, string>> = {
  USA: 't1', UK: 't15', France: 't17', Germany: 't24',
  USSR: 't39', Italy: 't55', Japan: 't65',
}

const NATION_COLORS: Record<Nation, string> = {
  Germany: '#5C5C68',
  USSR: '#B3382E',
  UK: '#1F3E78',
  USA: '#8C9A4A',
  Japan: '#C99A2E',
  France: '#5B86C9',
  Italy: '#1F7A42',
  Neutral: '#C7BE9E',
  None: '#163c54',
}

const STARTING_IPC: Record<Nation, number> = {
  Germany: 30,
  USSR: 28,
  UK: 25,
  USA: 40,
  Japan: 16,
  France: 15,
  Italy: 10,
  Neutral: 0,
  None: 0,
}

function buildLocationMap(): Record<string, string> {
  const map: Record<string, string> = {}
  TERRITORIES.forEach(t => {
    map[t.nameFI] = t.id
    map[t.nameEN] = t.id
  })
  SEA_ZONES.forEach(z => {
    map[z.nameFI] = z.id
    map[z.nameEN] = z.id
  })
  // Manual aliases for starting forces location strings
  map['Ruhr / Berliini'] = 't25'  // place in Ruhr, also populate Berlin separately
  map['Itä-Preussi'] = 't27'
  map['Saksa (lento)'] = 't24'
  map['Itämeri'] = 'sz_6'
  map['Pohjanmeri'] = 'sz_7'
  map['Moskova / Kiova'] = 't41'
  map['Leningrad'] = 't38'
  map['Kaukasus'] = 't42'
  map['Siperia'] = 't44'
  map['Moskova (lento)'] = 't41'
  map['Lontoo'] = 't15'
  map['Egypti'] = 't48'
  map['Intia'] = 't57'
  map['Lontoo (lento)'] = 't15'
  map['Kotilaivasto'] = 'sz_7'
  map['Välimeri'] = 'sz_8'
  map['Intian valtameri'] = 'sz_12'
  map['Pariisi'] = 't17'
  map['Etelä-Ranska'] = 't18'
  map['Pohjois-Afrikka'] = 't46'
  map['Pariisi (lento)'] = 't17'
  map['Pohjois-Italia'] = 't55'
  map['Rooma'] = 't56'
  map['Libya'] = 't47'
  map['Rooma (lento)'] = 't56'
  map['Tokio'] = 't66'
  map['Mantšuria'] = 't64'
  map['Korea'] = 't65'
  map['Tokio (lento)'] = 't66'
  map['Tyynimeri'] = 'sz_17'
  map['Itärannikko'] = 't1'
  map['Länsirannikko'] = 't3'
  map['Filippiinit'] = 't6'
  map['Itärannikko (lento)'] = 't1'
  map['Länsirannikko (lento)'] = 't3'
  map['Itärannikko (meri)'] = 'sz_1'
  return map
}

function initTerritories(): Record<string, Territory> {
  const result: Record<string, Territory> = {}
  TERRITORIES.forEach(t => {
    result[t.id] = {
      ...t,
      units: {} as Record<Nation, Record<string, number>>,
    }
  })
  return result
}

function initSeaZones(): Record<string, SeaZone> {
  const result: Record<string, SeaZone> = {}
  SEA_ZONES.forEach(z => {
    result[z.id] = {
      ...z,
      units: {} as Record<Nation, Record<string, number>>,
    }
  })
  return result
}

function placeStartingUnits(
  territories: Record<string, Territory>,
  seaZones: Record<string, SeaZone>
): void {
  const locMap = buildLocationMap()

  for (const [nationStr, locations] of Object.entries(STARTING_FORCES)) {
    const nation = nationStr as Nation
    for (const [location, stacks] of Object.entries(locations)) {
      const zoneId = locMap[location]
      if (!zoneId) continue

      const zone = territories[zoneId] ?? seaZones[zoneId]
      if (!zone) continue

      if (!zone.units[nation]) zone.units[nation] = {}
      for (const { unit, count } of stacks) {
        zone.units[nation][unit] = (zone.units[nation][unit] ?? 0) + count
      }
    }
  }
}

const PHASE_ORDER: Phase[] = ['diplomacy', 'purchase', 'orders', 'reveal', 'battle', 'income']

const nationsWithUnits = (zone: Territory | SeaZone): Nation[] =>
  (Object.entries(zone.units) as [Nation, Record<string, number>][])
    .filter(([, units]) => Object.values(units).some(n => n > 0))
    .map(([n]) => n)

const flattenForce = (units: Record<string, number> | undefined): Force => {
  const f: Force = {}
  for (const [uid, n] of Object.entries(units ?? {})) if (n > 0) f[uid] = n
  return f
}

const hasLandUnits = (f: Force): boolean =>
  Object.entries(f).some(([uid, n]) => n > 0 && ['infantry', 'armor'].includes(UNIT_TYPES[uid]?.category ?? ''))

// Evaluate victory conditions and stamp the winner onto the game if met.
function checkVictory(g: GameState): void {
  if (g.winner) return
  const vcOwner: Record<string, Nation> = {}
  const vcCount: Partial<Record<Nation, number>> = {}
  for (const t of Object.values(g.territories)) {
    if (!t.isVC) continue
    vcOwner[t.id] = t.owner
    if (t.owner !== 'Neutral' && t.owner !== 'None') vcCount[t.owner] = (vcCount[t.owner] ?? 0) + 1
  }
  // Solo victory: a single nation holds SOLO_VC_TARGET victory cities.
  for (const [nation, count] of Object.entries(vcCount) as [Nation, number][]) {
    if (count >= SOLO_VC_TARGET) {
      g.winner = nation; g.winningParties = [nation]; g.victoryType = 'solo'
      return
    }
  }
  // Alliance victory: an allied group holds ALLIANCE_VC_TARGET combined VCs AND
  // every member still holds its own capital.
  for (const al of g.alliances) {
    const combined = al.parties.reduce((s, n) => s + (vcCount[n] ?? 0), 0)
    const capitalsHeld = al.parties.every(n => {
      const cap = CAPITALS[n]
      return cap ? g.territories[cap]?.owner === n : true
    })
    if (combined >= ALLIANCE_VC_TARGET && capitalsHeld) {
      g.winner = al.parties[0]; g.winningParties = [...al.parties]; g.victoryType = 'alliance'
      return
    }
  }
}

type PendingMove = { source: string; picks: Record<string, number> }

type GameStore = {
  game: GameState | null
  selectedZoneId: string | null
  nationColors: Record<Nation, string>
  // In-map secret order UI state
  orderingNation: Nation | null            // whose turn it is to issue secret orders
  pendingMove: PendingMove | null          // when set, the next zone click is the destination
  moveMessage: string | null               // feedback after a move attempt (error or note)

  initGame: (playerConfig: Record<Nation, { type: PlayerType; pin: string }>, aiDifficulty?: AiDifficulty, name?: string) => void
  saveWar: (name: string) => string          // returns the save name used
  loadWar: (id: string) => boolean
  endWar: () => void                          // back to the lobby
  selectZone: (id: string | null) => void
  handleZoneClick: (id: string | null) => void   // routes to select or move-destination
  setOrderingNation: (n: Nation | null) => void
  beginMove: (source: string, picks: Record<string, number>) => void
  completeMove: (dest: string) => string | null
  cancelMove: () => void
  calculateIncome: (nation: Nation) => number

  submitOrder: (order: Omit<MoveOrder, 'id'>) => string | null   // returns error string or null
  removeOrder: (nation: Nation, orderId: string) => void
  lockOrders: (nation: Nation) => void
  confirmPurchase: (nation: Nation, cart: Record<string, number>, factoryId: string) => string | null
  buyTech: (nation: Nation, branch: keyof import('../data/types').TechLevels) => string | null
  noteStrategy: (nation: Nation, text: string) => void
  advancePhase: () => void

  applyDiplomacyCommand: (text: string) => string | null   // returns error or null
  submitSpyOrder: (spy: Nation, target: Nation, points: number) => string | null
  clearSpyOrders: (spy: Nation) => void
  buyIntel: (nation: Nation, kind: 'codeBreaking' | 'encryption') => string | null
}

const DEFAULT_NATIONS: Nation[] = ['Germany', 'USSR', 'UK', 'USA', 'Japan', 'France', 'Italy']

// Two nations are friendly if they share an alliance or an active non-aggression
// pact. Friendly troops may pass through and share zones without fighting.
function areFriendly(g: GameState, a: Nation, b: Nation): boolean {
  if (a === b) return true
  if (a === 'Neutral' || a === 'None' || b === 'Neutral' || b === 'None') return false
  return g.alliances.some(al => al.parties.includes(a) && al.parties.includes(b))
    || g.pacts.some(p => p.parties.includes(a) && p.parties.includes(b))
}

// Aggressor `a` attacks partner `b`: tear up any alliance or non-aggression pact
// binding them the instant fighting erupts. In a multi-party alliance the
// aggressor is expelled; a pact between them is dissolved outright.
function breakRelations(g: GameState, a: Nation, b: Nation): void {
  let broke = false
  const before = g.pacts.length
  g.pacts = g.pacts.filter(p => !(p.parties.includes(a) && p.parties.includes(b)))
  if (g.pacts.length !== before) broke = true
  const remaining: typeof g.alliances = []
  for (const al of g.alliances) {
    if (al.parties.includes(a) && al.parties.includes(b)) {
      broke = true
      const parties = al.parties.filter(p => p !== a)   // the aggressor is cast out
      if (parties.length >= 2) remaining.push({ ...al, parties })
    } else remaining.push(al)
  }
  g.alliances = remaining
  if (broke) {
    const text = `${a} broke the peace with ${b} — their alliance/non-aggression pact is torn up`
    g.diplomacyLog.push({ round: g.round, text })
    g.chronicle.push({ round: g.round, kind: 'treaty', text })
  }
}

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    game: null,
    selectedZoneId: null,
    nationColors: NATION_COLORS,
    orderingNation: null,
    pendingMove: null,
    moveMessage: null,

    initGame: (playerConfig, aiDifficulty = 'normal', name = 'New War') => {
      const territories = initTerritories()
      const seaZones = initSeaZones()
      placeStartingUnits(territories, seaZones)

      const players: Partial<Record<Nation, Player>> = {}
      for (const nation of DEFAULT_NATIONS) {
        const cfg = playerConfig[nation] ?? { type: 'npn' as PlayerType, pin: '0000' }
        players[nation] = {
          nation,
          type: cfg.type,
          pin: cfg.pin,
          ipc: STARTING_IPC[nation],
          techLevels: { land: 0, air: 0, naval: 0, industry: 0 },
          codeBreaking: false,
          encryption: false,
        }
      }

      set(state => {
        state.game = {
          name,
          round: 1,
          phase: 'diplomacy',
          players: players as Record<Nation, Player>,
          territories,
          seaZones,
          productionQueues: {} as GameState['productionQueues'],
          activeNation: null,
          orders: {},
          standingOrders: [],
          lockedNations: [],
          battleReports: [],
          incomeReport: {},
          alliances: [],
          pacts: [],
          mercenaries: [],
          warRequests: [],
          diplomacyLog: [],
          spyOrders: [],
          spyReports: [],
          winner: null,
          winningParties: [],
          victoryType: null,
          chronicle: [],
          strategicNotes: [],
          aiDifficulty,
          history: [],
          revealedArrows: [],
          revealedBattles: [],
        }
      })
    },

    saveWar: (name) => {
      const g = get().game
      if (g) { writeSave(name, g); set(state => { if (state.game) state.game.name = name.trim() }) }
      return name.trim()
    },

    loadWar: (id) => {
      const state = readSave(id)
      if (!state) return false
      // Back-fill fields added after older saves were written.
      if (!state.warRequests) state.warRequests = []
      set(s => { s.game = state; s.selectedZoneId = null; s.orderingNation = null; s.pendingMove = null; s.moveMessage = null })
      return true
    },

    endWar: () => set(s => {
      s.game = null; s.selectedZoneId = null; s.orderingNation = null; s.pendingMove = null; s.moveMessage = null
    }),

    selectZone: (id) => set(state => { state.selectedZoneId = id }),

    setOrderingNation: (n) => set(state => {
      state.orderingNation = n
      state.pendingMove = null
    }),

    beginMove: (source, picks) => set(state => {
      state.pendingMove = { source, picks }
      state.moveMessage = null
    }),

    cancelMove: () => set(state => { state.pendingMove = null }),

    completeMove: (dest) => {
      const { pendingMove, orderingNation, game, submitOrder } = get()
      if (!pendingMove || !orderingNation || !game) return 'No move in progress'
      if (dest === pendingMove.source) { set(s => { s.pendingMove = null }); return null }

      // Pre-evaluate for warnings (multi-turn march) and confirmation.
      let anyMultiTurn = false
      for (const [unit, count] of Object.entries(pendingMove.picks)) {
        if (count <= 0) continue
        const plan = evaluateMove(game, orderingNation, pendingMove.source, dest, unit)
        if (plan.ok && plan.multiTurn) anyMultiTurn = true
      }
      if (anyMultiTurn && typeof window !== 'undefined') {
        const proceed = window.confirm(
          'This destination is farther than the units can march in one turn.\n\n' +
          'Issue it as a STANDING ORDER? The units will keep advancing automatically each turn until they arrive — or press Cancel to pick a nearer zone.')
        if (!proceed) { set(s => { s.pendingMove = null }); return null }
      }

      // Moving into an ally / non-aggression partner's zone: by default it's a
      // peaceful passage (no battle). Offer to make it a deliberate attack.
      let intent: 'attack' | 'move' | undefined
      const destZone = game.territories[dest] ?? game.seaZones[dest]
      const friends = new Set<Nation>()
      if (destZone) {
        const owner = destZone.type === 'land' ? (destZone as Territory).owner : null
        if (owner && owner !== orderingNation && areFriendly(game, orderingNation, owner)) friends.add(owner)
        for (const n of Object.keys(destZone.units) as Nation[])
          if (n !== orderingNation && areFriendly(game, orderingNation, n)) friends.add(n)
      }
      if (friends.size > 0 && typeof window !== 'undefined') {
        const who = [...friends].join(', ')
        const attack = window.confirm(
          `${who} is your ally / non-aggression partner and holds this zone.\n\n` +
          'Press OK to ATTACK them here (this breaks the peace), or Cancel to move in peacefully — your troops will pass through / station alongside without fighting.')
        intent = attack ? 'attack' : 'move'
      }

      let firstError: string | null = null
      let ok = 0
      for (const [unit, count] of Object.entries(pendingMove.picks)) {
        if (count <= 0) continue
        const err = submitOrder({ nation: orderingNation, from: pendingMove.source, to: dest, unit, count, intent })
        if (err && !firstError) firstError = err
        else if (!err) ok++
      }
      set(s => { s.pendingMove = null; s.moveMessage = firstError ?? (ok > 0 ? (anyMultiTurn ? 'Standing order issued — units will march over several turns.' : null) : null) })
      return firstError
    },

    // Map click router: while planning a move, the next click picks the destination;
    // otherwise it just selects the zone for inspection.
    handleZoneClick: (id) => {
      const { pendingMove } = get()
      if (pendingMove && id) {
        get().completeMove(id)
        set(s => { s.selectedZoneId = id })
        return
      }
      set(s => { s.selectedZoneId = id })
    },

    calculateIncome: (nation) => {
      const { game } = get()
      if (!game) return 0
      let income = 0
      for (const t of Object.values(game.territories)) {
        if (t.owner === nation) {
          // Partisans reduce IPC by 1 each
          const partisans = t.units['Neutral']?.['partisan'] ?? 0
          income += Math.max(0, t.ipc - partisans)
        }
      }
      return income
    },

    submitOrder: (order) => {
      const { game } = get()
      if (!game) return 'No game'
      if (game.phase !== 'orders') return 'Not in orders phase'
      if (game.lockedNations.includes(order.nation)) return 'Orders locked'
      const zone = game.territories[order.from] ?? game.seaZones[order.from]
      if (!zone) return 'Unknown source zone'
      const available = zone.units[order.nation]?.[order.unit] ?? 0
      // Subtract units already committed from this zone in other orders
      const committed = (game.orders[order.nation] ?? [])
        .filter(o => o.from === order.from && o.unit === order.unit)
        .reduce((s, o) => s + o.count, 0)
      if (available - committed < order.count) return `Only ${available - committed} available`

      // Validate against the adjacency graph: range, sea crossings, carriers.
      // Humans AND the AI obey the same rules — a land army may only cross open
      // sea when a Transport bridges it, so the AI can't teleport invasions.
      const plan = evaluateMove(game, order.nation, order.from, order.to, order.unit)
      if (!plan.ok) return plan.reason ?? 'Illegal move'

      set(state => {
        const g = state.game!
        if (!g.orders[order.nation]) g.orders[order.nation] = []
        g.orders[order.nation]!.push({
          ...order,
          id: `${order.nation}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          path: plan.path,
          standing: plan.multiTurn,
          needsTransport: plan.needsTransport,
          transportZone: plan.transportZone,
          intent: order.intent,
        })
      })
      return null
    },

    removeOrder: (nation, orderId) => set(state => {
      const g = state.game
      if (!g || g.lockedNations.includes(nation)) return
      g.orders[nation] = (g.orders[nation] ?? []).filter(o => o.id !== orderId)
    }),

    lockOrders: (nation) => set(state => {
      const g = state.game
      if (g && !g.lockedNations.includes(nation)) g.lockedNations.push(nation)
    }),

    confirmPurchase: (nation, cart, factoryId) => {
      const { game } = get()
      if (!game) return 'No game'
      const player = game.players[nation]
      const cost = Object.entries(cart).reduce((s, [uid, n]) => s + unitCostWithTech(uid, player.techLevels) * n, 0)
      if (cost > player.ipc) return 'Not enough IPC'
      const factory = game.territories[factoryId]
      if (!factory || !factory.hasFactory || factory.owner !== nation) return 'Invalid factory'

      set(state => {
        const g = state.game!
        g.players[nation].ipc -= cost
        if (!g.productionQueues[nation]) g.productionQueues[nation] = []
        for (const [uid, count] of Object.entries(cart)) {
          if (count > 0) g.productionQueues[nation].push({
            unit: uid, count, factory: factoryId,
            turnsRemaining: UNIT_TYPES[uid]?.buildTime ?? 1,
          })
        }
      })
      return null
    },

    noteStrategy: (nation, text) => set(state => {
      const g = state.game
      if (g && text) g.strategicNotes.push({ round: g.round, nation, text })
    }),

    buyTech: (nation, branch) => {
      const { game } = get()
      if (!game) return 'No game'
      const player = game.players[nation]
      if (player.techLevels[branch] >= 3) return 'Already at maximum level'
      if (player.ipc < TECH_COST) return `Research costs ${TECH_COST} IPC`
      set(state => {
        const p = state.game!.players[nation]
        p.ipc -= TECH_COST
        p.techLevels[branch] += 1
      })
      return null
    },

    // ── Diplomacy commands ──────────────────────────────────────────────────
    applyDiplomacyCommand: (text) => {
      const { game } = get()
      if (!game) return 'No game'
      const parsed = parseCommand(text)
      if (!parsed.ok) return parsed.error
      const cmd = parsed.command

      // Validate resource-affecting commands before mutating
      if (cmd.kind === 'TRANSFER' && game.players[cmd.from].ipc < cmd.ipc)
        return `${cmd.from} has only ${game.players[cmd.from].ipc} IPC`
      if (cmd.kind === 'MERCENARY' && game.players[cmd.hirer].ipc < cmd.ipc)
        return `${cmd.hirer} has only ${game.players[cmd.hirer].ipc} IPC`
      if (cmd.kind === 'REQUEST' && !areAllied(game.alliances, cmd.from, cmd.ally))
        return `${cmd.from} and ${cmd.ally} are not allied — form an alliance first`

      set(state => {
        const g = state.game!
        const id = `${cmd.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
        if (cmd.kind === 'ALLIANCE') {
          g.alliances.push({ id, parties: cmd.parties, sinceRound: g.round })
          g.diplomacyLog.push({ round: g.round, text: `Alliance formed: ${cmd.parties.join(' + ')}` })
        } else if (cmd.kind === 'TRANSFER') {
          g.players[cmd.from].ipc -= cmd.ipc
          g.players[cmd.to].ipc += cmd.ipc
          g.diplomacyLog.push({ round: g.round, text: `${cmd.from} → ${cmd.to}: ${cmd.ipc} IPC${cmd.route ? ` via ${cmd.route}` : ''}` })
        } else if (cmd.kind === 'NON-AGGRESSION') {
          g.pacts.push({ id, parties: cmd.parties, untilRound: g.round + cmd.rounds })
          g.diplomacyLog.push({ round: g.round, text: `Non-aggression (${cmd.rounds}r): ${cmd.parties.join(' + ')}` })
        } else if (cmd.kind === 'MERCENARY') {
          g.players[cmd.hirer].ipc -= cmd.ipc
          g.players[cmd.owner].ipc += cmd.ipc
          g.mercenaries.push({ id, ipc: cmd.ipc, unit: cmd.unit, owner: cmd.owner, hirer: cmd.hirer, round: g.round })
          g.diplomacyLog.push({ round: g.round, text: `${cmd.hirer} hires ${UNIT_TYPES[cmd.unit]?.nameFI ?? cmd.unit} from ${cmd.owner} (${cmd.ipc} IPC)` })
        } else if (cmd.kind === 'REQUEST') {
          // Supersede any earlier call from the same ally onto the same target.
          g.warRequests = g.warRequests.filter(r => !(r.from === cmd.from && r.ally === cmd.ally && r.target === cmd.target))
          g.warRequests.push({ from: cmd.from, ally: cmd.ally, target: cmd.target, round: g.round })
          g.diplomacyLog.push({ round: g.round, text: `${cmd.from} calls on ally ${cmd.ally} to make war on ${cmd.target}` })
          g.chronicle.push({ round: g.round, kind: 'treaty', text: `${cmd.from} urged ${cmd.ally} to attack ${cmd.target}` })
        }
      })
      return null
    },

    // ── Espionage ───────────────────────────────────────────────────────────
    submitSpyOrder: (spy, target, points) => {
      const { game } = get()
      if (!game) return 'No game'
      if (points <= 0) return 'Allocate at least 1 point'
      const cost = points * SPY_POINT_COST
      if (game.players[spy].ipc < cost) return `Costs ${cost} IPC — ${spy} has ${game.players[spy].ipc}`
      set(state => {
        const g = state.game!
        g.players[spy].ipc -= cost
        const existing = g.spyOrders.find(s => s.spy === spy && s.target === target)
        if (existing) existing.points += points
        else g.spyOrders.push({ spy, target, points })
      })
      return null
    },

    clearSpyOrders: (spy) => set(state => {
      const g = state.game
      if (!g) return
      // Refund and remove this nation's spy orders
      for (const so of g.spyOrders.filter(s => s.spy === spy)) g.players[spy].ipc += so.points * SPY_POINT_COST
      g.spyOrders = g.spyOrders.filter(s => s.spy !== spy)
    }),

    buyIntel: (nation, kind) => {
      const { game } = get()
      if (!game) return 'No game'
      const player = game.players[nation]
      if (player[kind]) return kind === 'codeBreaking' ? 'Already have code-breaking' : 'Already encrypted'
      const cost = kind === 'codeBreaking' ? CODE_BREAKING_COST : ENCRYPTION_COST
      if (player.ipc < cost) return `Costs ${cost} IPC — ${nation} has ${player.ipc}`
      set(state => {
        const g = state.game!
        g.players[nation].ipc -= cost
        g.players[nation][kind] = true
      })
      return null
    },

    advancePhase: () => set(state => {
      const g = state.game
      if (!g) return
      const idx = PHASE_ORDER.indexOf(g.phase)
      const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length]
      // Zones each nation actually advanced INTO this turn (attackers for combat)
      const moverStops = new Set<string>()
      // `nation:zone` entries a player deliberately ordered as an attack on a
      // friendly (ally / non-aggression) holder — otherwise entry is peaceful.
      const attackIntents = new Set<string>()

      // ── Entering reveal → resolve espionage, snapshot arrows for the map ──
      if (next === 'reveal') {
        g.spyReports = resolveEspionage(g.round, g.spyOrders, g.orders, g.players)
        // Persist the revealed movements so the arrows stay on the map (through the
        // rest of this round and the next round's planning) until the NEXT reveal.
        g.revealedArrows = [
          ...(Object.values(g.orders).flat().filter(Boolean) as MoveOrder[]),
          ...g.standingOrders,
        ].map(o => ({ ...o }))
        g.revealedBattles = []
      }

      // ── Leaving reveal → advance all movements along their paths ──────────
      // Units travel up to their range per turn; over-range marches persist as
      // standing orders and continue automatically next turn.
      if (g.phase === 'reveal') {
        const active: MoveOrder[] = [
          ...(Object.values(g.orders).flat().filter(Boolean) as MoveOrder[]),
          ...g.standingOrders,
        ]
        const continuations: MoveOrder[] = []
        for (const o of active) {
          const path = o.path && o.path.length > 1 ? o.path : [o.from, o.to]
          const range = o.needsTransport ? path.length - 1 : (UNIT_TYPES[o.unit]?.move ?? 1)
          const steps = Math.max(1, Math.min(range, path.length - 1))
          const dest = path[steps]
          const from = g.territories[path[0]] ?? g.seaZones[path[0]]
          const to = g.territories[dest] ?? g.seaZones[dest]
          if (!from || !to) continue
          const have = from.units[o.nation]?.[o.unit] ?? 0
          const moving = Math.min(have, o.count)
          if (moving <= 0) continue
          from.units[o.nation]![o.unit] -= moving
          if (from.units[o.nation]![o.unit]! <= 0) delete from.units[o.nation]![o.unit]
          if (!to.units[o.nation]) to.units[o.nation] = {}
          to.units[o.nation]![o.unit] = (to.units[o.nation]![o.unit] ?? 0) + moving
          moverStops.add(`${o.nation}:${dest}`)
          if (o.intent === 'attack') attackIntents.add(`${o.nation}:${dest}`)
          if (dest !== o.to) continuations.push({ ...o, from: dest, path: path.slice(steps), count: moving })
        }
        g.standingOrders = continuations
      }

      // ── Entering battle → resolve every contested zone ───────────────────
      if (next === 'battle') {
        g.battleReports = []
        const movers = moverStops // zones each nation actually advanced into this turn

        const allZones: (Territory | SeaZone)[] = [...Object.values(g.territories), ...Object.values(g.seaZones)]
        for (const zone of allZones) {
          const present = nationsWithUnits(zone)
          const isLand = zone.type === 'land'
          const owner = isLand ? (zone as Territory).owner : null

          // Determine attacker: a nation that moved in this round and is not the
          // owner. A mover entering a FRIENDLY holder's zone only counts as an
          // attacker if it deliberately chose to attack there.
          const attacker = present.find(n => movers.has(`${n}:${zone.id}`) && n !== owner &&
            (!(isLand && owner && areFriendly(g, n, owner)) || attackIntents.has(`${n}:${zone.id}`)))
          if (!attacker) continue

          // Determine defender: owner units, other nation's units, or neutral garrison
          let defender: Nation | null = null
          let defenderForce: Force = {}
          const others = present.filter(n => n !== attacker)
          if (others.length > 0) {
            // Prefer a hostile occupant; friendly troops share the zone in peace.
            defender = others.find(n => !areFriendly(g, attacker, n) || attackIntents.has(`${attacker}:${zone.id}`)) ?? null
            if (defender) defenderForce = flattenForce(zone.units[defender])
          } else if (isLand && owner && owner !== attacker && owner !== 'None') {
            defender = owner
            const t = zone as Territory
            defenderForce = owner === 'Neutral' && t.neutralJV > 0 ? { infantry: t.neutralJV } : {}
          }
          if (!defender) continue

          // Fighting a former ally / pact partner instantly voids that treaty.
          if (defender !== 'Neutral' && areFriendly(g, attacker, defender)) breakRelations(g, attacker, defender)

          const attackerForce = flattenForce(zone.units[attacker])
          if (Object.keys(attackerForce).length === 0) continue

          // Unopposed walk-in: capture without dice
          if (Object.keys(defenderForce).length === 0) {
            if (isLand && hasLandUnits(attackerForce)) {
              (zone as Territory).owner = attacker
              g.battleReports.push({
                zoneId: zone.id, zoneName: zone.nameEN, attacker, defender,
                attackerInitial: { ...attackerForce }, defenderInitial: {},
                rounds: [], attackerRemaining: attackerForce, defenderRemaining: {},
                winner: 'attacker', log: [`${attacker} occupies ${zone.nameEN} unopposed`],
              } as BattleResult)
              g.chronicle.push({
                round: g.round, kind: 'conquest',
                text: `${attacker} occupied ${zone.nameEN}${(zone as Territory).isVC ? ` (Victory City ${(zone as Territory).vcName})` : ''} unopposed`,
              })
            }
            continue
          }

          const result = resolveBattle(
            zone.id, zone.nameEN, attacker, attackerForce, defender, defenderForce, 10,
            { atk: g.players[attacker]?.techLevels, def: g.players[defender]?.techLevels },
          )
          g.battleReports.push(result)

          // Apply outcome to zone
          zone.units[attacker] = { ...result.attackerRemaining }
          if (defender !== 'Neutral' || !isLand) {
            zone.units[defender] = { ...result.defenderRemaining }
          }
          const sum = (f: Record<string, number>) => Object.values(f).reduce((s, n) => s + n, 0)
          const aLost = sum(result.attackerInitial) - sum(result.attackerRemaining)
          const dLost = sum(result.defenderInitial) - sum(result.defenderRemaining)
          const casualties = `(${attacker} lost ${aLost}, ${defender} lost ${dLost})`
          if (result.winner === 'attacker' && isLand && hasLandUnits(result.attackerRemaining)) {
            (zone as Territory).owner = attacker
            g.chronicle.push({
              round: g.round, kind: 'conquest',
              text: `${attacker} took ${zone.nameEN}${(zone as Territory).isVC ? ` (Victory City ${(zone as Territory).vcName})` : ''} from ${defender} ${casualties}`,
            })
          } else if (result.winner === 'defender') {
            g.chronicle.push({ round: g.round, kind: 'battle', text: `${defender} repelled ${attacker}'s assault on ${zone.nameEN} ${casualties}` })
          } else {
            g.chronicle.push({ round: g.round, kind: 'battle', text: `${attacker}'s attack on ${zone.nameEN} stalled ${casualties}` })
          }
        }
        // Territory ownership may have changed — evaluate victory conditions.
        checkVictory(g)
        // Battle-site markers for the map (persist until the next reveal).
        g.revealedBattles = g.battleReports.map(b => ({ zoneId: b.zoneId, winner: b.winner }))
      }

      // ── Entering income → collect IPC, advance production ────────────────
      if (next === 'income') {
        g.incomeReport = {}
        for (const nation of DEFAULT_NATIONS) {
          let income = 0
          for (const t of Object.values(g.territories)) {
            if (t.owner === nation) {
              const partisans = t.units['Neutral']?.['partisan'] ?? 0
              income += Math.max(0, t.ipc - partisans)
            }
          }
          g.players[nation].ipc += income
          g.incomeReport[nation] = income
        }
        // Record a power snapshot: leader by IPC and by Victory Cities held.
        const vcTally: Partial<Record<Nation, number>> = {}
        for (const t of Object.values(g.territories)) {
          if (t.isVC && t.owner !== 'Neutral' && t.owner !== 'None') vcTally[t.owner] = (vcTally[t.owner] ?? 0) + 1
        }
        const ipcLeader = DEFAULT_NATIONS.reduce((a, b) => (g.players[b].ipc > g.players[a].ipc ? b : a))
        const vcLeader = (Object.entries(vcTally) as [Nation, number][]).sort((a, b) => b[1] - a[1])[0]
        g.chronicle.push({
          round: g.round, kind: 'power',
          text: `By ${roundToDate(g.round).long}, ${ipcLeader} led in production (${g.players[ipcLeader].ipc} IPC)` +
            (vcLeader ? `; ${vcLeader[0]} held the most Victory Cities (${vcLeader[1]})` : ''),
        })

        // ── Statistics snapshot for this round ──────────────────────────────
        const allZones = [...Object.values(g.territories), ...Object.values(g.seaZones)]
        const losses: Partial<Record<Nation, number>> = {}
        for (const b of g.battleReports) {
          for (const r of b.rounds) {
            losses[b.attacker] = (losses[b.attacker] ?? 0) + Object.values(r.attackerLosses).reduce((s, n) => s + n, 0)
            losses[b.defender] = (losses[b.defender] ?? 0) + Object.values(r.defenderLosses).reduce((s, n) => s + n, 0)
          }
        }
        const perNation: Partial<Record<Nation, import('../data/types').NationStat>> = {}
        for (const nation of DEFAULT_NATIONS) {
          let territories = 0
          for (const t of Object.values(g.territories)) if (t.owner === nation) territories++
          let units = 0
          for (const z of allZones) {
            const u = z.units[nation]
            if (u) units += Object.values(u).reduce((s, n) => s + n, 0)
          }
          perNation[nation] = {
            ipc: g.players[nation].ipc,
            income: g.incomeReport[nation] ?? 0,
            territories,
            vcs: vcTally[nation] ?? 0,
            units,
            losses: losses[nation] ?? 0,
          }
        }
        const ownership: Record<string, Nation> = {}
        for (const t of Object.values(g.territories)) ownership[t.id] = t.owner
        // Per-zone force totals (for the war-room troop badges)
        const forces: Record<string, Partial<Record<Nation, number>>> = {}
        for (const z of allZones) {
          const per: Partial<Record<Nation, number>> = {}
          for (const [nat, u] of Object.entries(z.units)) {
            const tot = Object.values(u ?? {}).reduce((s, c) => s + c, 0)
            if (tot > 0) per[nat as Nation] = tot
          }
          if (Object.keys(per).length) forces[z.id] = per
        }
        g.history.push({
          round: g.round, perNation, ownership,
          arrows: g.revealedArrows.map(o => ({ ...o })),
          battles: g.revealedBattles.map(b => ({ ...b })),
          forces,
        })

        // Advance production queues; deploy finished units at their factory
        for (const [nationStr, queue] of Object.entries(g.productionQueues)) {
          const nation = nationStr as Nation
          const remaining: typeof queue = []
          for (const item of queue ?? []) {
            item.turnsRemaining -= 1
            if (item.turnsRemaining <= 0) {
              const t = g.territories[item.factory]
              if (t && t.owner === nation) {
                if (!t.units[nation]) t.units[nation] = {} as Record<string, number>
                t.units[nation][item.unit] = (t.units[nation][item.unit] ?? 0) + item.count
              }
            } else {
              remaining.push(item)
            }
          }
          g.productionQueues[nation] = remaining
        }
      }

      // ── Leaving income → new round ────────────────────────────────────────
      if (g.phase === 'income') {
        g.round += 1
        g.orders = {}
        g.lockedNations = []
        g.battleReports = []
        g.incomeReport = {}
        g.spyOrders = []
        g.spyReports = []
        // Expire lapsed non-aggression pacts
        g.pacts = g.pacts.filter(p => p.untilRound > g.round)
        // Calls to arms lapse after two rounds unless renewed
        g.warRequests = g.warRequests.filter(r => g.round - r.round < 2)
      }

      g.phase = next
      // Reset in-map ordering state whenever the phase changes.
      state.orderingNation = null
      state.pendingMove = null
    }),
  }))
)

export { NATION_COLORS }
