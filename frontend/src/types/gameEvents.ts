export type PlayerId = number

export type RoleName
  = | 'resistance'
    | 'spy'
    | 'commander'
    | 'bodyguard'
    | 'assassin'
    | 'false-commander'
    | 'deep-cover'
    | 'blind-spy'

export type KnownRole = RoleName | 'commander-candidate'

export type GamePhase
  = | 'lobby'
    | 'role-reveal'
    | 'nomination'
    | 'voting'
    | 'suspicion'
    | 'mission'
    | 'assassination'
    | 'game-over'

/**
 * Outcome reasons emitted by the backend's `game:ended` (see
 * `backend/game/plugins/ResistanceCore.ts`). This file mirrors the backend
 * event contract, so new reasons get added here alongside the events.
 */
export const GAME_OUTCOME_TYPES = [
  { title: 'Mission Victory', value: 'mission-victory' },
  { title: 'Nomination Limit', value: 'nomination-limit' },
] as const

export type ClientEventsBase = {
  /** Host-only. All fields optional — only provided fields are applied. */
  'game:configure': {
    modulesEnabled?: string[]
    optionalRoles?: RoleName[]
  }
  'game:start': {
    leaderId: PlayerId
    seatOrder: PlayerId[]
  }
  'role:submit': {
    role: RoleName
  }
  'nomination:submit': {
    team: PlayerId[]
  }
  'vote:cast': {
    vote: boolean
  }
  'sus:submit': {
    sus: Record<PlayerId, number>
  }
  'mission:play-card': {
    card: boolean
  }
  /**
   * Host-only seat reorder during the lobby phase. Server validates that
   * `seatOrder` contains exactly the current player set with no duplicates.
   */
  'lobby:reorder': {
    seatOrder: PlayerId[]
  }
}

export type ServerEvents = {
  'player:joined': {
    playerId: PlayerId
    players: PlayerId[]
  }
  'player:left': {
    playerId: PlayerId
  }
  /**
   * Broadcast on join, leave, or explicit lobby:reorder. Clients should
   * replace their local seat order with the supplied `seatOrder`.
   */
  'lobby:reordered': {
    seatOrder: PlayerId[]
    hostId: PlayerId | null
  }
  /** Broadcast whenever the host changes the game configuration. */
  'game:configured': {
    modulesEnabled: string[]
    optionalRoles: RoleName[]
  }
  'game:started': Record<string, never>
  'role:assigned': {
    role: RoleName
    knownRoles: Record<PlayerId, KnownRole> | undefined
  }
  /**
   * Self-reported roles didn't form a legal composition; all roles were
   * cleared and everyone must re-submit.
   */
  'role:reset': {
    message: string
  }
  'mission:card-played': {
    playerId: PlayerId
  }
  'nomination:started': {
    leaderId: PlayerId
    mission: number
    round: number
  }
  'nomination:submitted': {
    team: PlayerId[]
  }
  'vote:received': {
    playerId: PlayerId
  }
  'vote:result': {
    votes: Record<PlayerId, boolean>
    approved: boolean
  }
  'suspicion:started': Record<string, never>
  'mission:started': {
    mission: number
    leaderId: PlayerId
    team: PlayerId[]
  }
  'mission:result': {
    result: boolean
    failCount: number
  }
  'game:ended': {
    winner: 'resistance' | 'spies'
    reason: string
  }
  'state:update': {
    state: string
  }
  'socket:error': {
    message: string
  }
}
