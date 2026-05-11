import { useGameStore } from '@/stores/game'

interface SeedOptions {
  myId?: number
  playerIds?: number[]
  /** If true, set leaderId === myId so amLeader is true. */
  asLeader?: boolean
  /**
   * Explicit hostId. Defaults to playerIds[0] (the seed's "you're the host"
   * convention). The store's isHost derives from this, NOT from seat order.
   */
  hostId?: number
  mission?: number
  nominatedTeam?: number[]
  winner?: 'resistance' | 'spies' | null
  phase?: ReturnType<typeof useGameStore>['phase']
}

/**
 * Seed the game store with a sane default game state for component tests.
 * Anything you don't pass falls back to a 5-player game where you are the
 * first player (myId = 1, leader of mission 0).
 */
export function seedGameStore (opts: SeedOptions = {}) {
  const store = useGameStore()
  const playerIds = opts.playerIds ?? [1, 2, 3, 4, 5]
  const myId = opts.myId ?? playerIds[0]!

  store.myId = myId
  store.playerIds = playerIds
  store.playerProfiles = Object.fromEntries(
    playerIds.map(id => [id, { username: `Player ${id}`, avatar: undefined }]),
  )
  store.hostId = opts.hostId ?? playerIds[0] ?? null
  store.leaderId = opts.asLeader === false ? (playerIds[1] ?? null) : myId
  store.mission = opts.mission ?? 0
  store.nominatedTeam = opts.nominatedTeam ?? []
  store.winner = opts.winner ?? null
  if (opts.phase) {
    store.phase = opts.phase
  }
  return store
}
