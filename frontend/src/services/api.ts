/**
 * Centralized HTTP API surface for the new metrics / leaderboard / end-state pages.
 *
 * The backend is on the same origin in prod and behind a Vite proxy in dev,
 * so URLs are kept relative. All requests forward cookies for auth.
 */

export type Side = 'resistance' | 'spy'
export type Winner = 'resistance' | 'spies' | null
export type LeaderboardMetric = 'pIndex' | 'rIndex' | 'sIndex' | 'lifetimePoints'

export interface IndexTriple {
  rIndex: number | null
  sIndex: number | null
  pIndex: number | null
}

export interface IndexHistoryPoint {
  gameid: number
  endTimestamp: string
  side: Side
  /** Points earned in this game. */
  points: number
  /** Indices as of (and including) this game. */
  rIndex: number | null
  sIndex: number | null
  pIndex: number | null
}

export interface UserIndex {
  rIndex: number | null
  sIndex: number | null
  pIndex: number | null
  /** Per-game index trajectory, chronological (oldest first). */
  history: IndexHistoryPoint[]
  details: {
    resistanceGames: number
    spyGames: number
    weighting: { strategy: 'uniform' | 'expdecay', alpha?: number }
    catalogVersion: string | null
    asOf: string | null
  }
}

export interface UserMetrics {
  counts: {
    games: number
    wins: number
    losses: number
    gamesAsResistance: number
    gamesAsSpy: number
  }
  lifetimePoints: { resistance: number, spy: number, total: number }
  resistance: { RoS_L: number | null, RoP_L: number | null }
  spy: { RoI_L: number | null, RoIF_L: number | null }
}

export interface UserGameLogEntry {
  gameid: number
  endTimestamp: string
  side: Side
  role: string
  points: number
  won: boolean | null
  outcomeType: string | null
  missionStatuses: boolean[]
  playerCount: number
}

export interface UserGameLog {
  rows: UserGameLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface LeaderboardEntry {
  rank: number
  userid: number
  username: string | null
  pfp: string | null
  value: number
  games: number
}

export interface Leaderboard {
  metric: LeaderboardMetric
  weighting: { strategy: 'uniform' | 'expdecay', alpha?: number }
  rows: LeaderboardEntry[]
}

export interface GamePlayerStats {
  timesNominated: number
  missionsParticipated: number
  timesLed: number
  timesApproved: number
  timesRejected: number
  successCardsPlayed: number
  failCardsPlayed: number
}

export interface GamePlayerMetrics {
  userid: number
  username: string | null
  pfp: string | null
  role: string
  side: Side
  points: number
  breakdown: Record<string, number>
  catalogVersion: string
  complexMetric: { key: 'RoS_G' | 'RoI_G', value: number | null }
  stats: GamePlayerStats
  indexBefore: IndexTriple
  indexAfter: IndexTriple
  indexDelta: IndexTriple
}

export interface GameMetrics {
  gameid: number
  endTimestamp: string | null
  outcome: {
    winner: Winner
    outcomeType: string | null
    missionStatuses: boolean[]
    countFailedVotes: number
  }
  teams: {
    resistance: { totalPoints: number, players: GamePlayerMetrics[] }
    spy: { totalPoints: number, players: GamePlayerMetrics[] }
  }
  details: {
    weighting: { strategy: 'uniform' | 'expdecay', alpha?: number }
    catalogVersion: string
  }
}

export interface GameReplayPlayer {
  userid: number
  username: string | null
  pfp: string | null
  role: string
  side: Side
}

export interface GameReplayRound {
  roundId: number
  /** 1..5 — which mission this nomination attempt belongs to. */
  missionIndex: number
  /** 1..N — attempt index within the current mission. */
  nominationAttempt: number
  leaderUserid: number | null
  team: number[]
  countSpiesNominated: number | null
  votePoll: Record<string, boolean> | null
  voteStatus: boolean | null
  missionStatus: boolean | null
  missionCards: Record<string, 'success' | 'fail'> | null
  suspicions: Record<string, Record<string, number>> | null
}

export interface EvalPoint {
  /** Aligns with GameReplayRound.roundId. */
  roundId: number
  /** Team points earned in this round alone. */
  resistanceDelta: number
  spyDelta: number
  /** Cumulative resistance − spy points after this round. */
  differential: number
}

export interface GameReplay {
  gameid: number
  startTimestamp: string | null
  endTimestamp: string | null
  outcome: {
    winner: Winner
    outcomeType: string | null
    missionStatuses: Array<boolean | null>
  }
  players: GameReplayPlayer[]
  rounds: GameReplayRound[]
  /** Chess-style eval trajectory, one point per round (in round order). */
  evalSeries: EvalPoint[]
}

interface FetchOptions {
  signal?: AbortSignal
}

async function getJson<T> (url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetch(url, { credentials: 'include', signal: opts.signal })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GET ${url} → ${res.status}${text ? `: ${text}` : ''}`)
  }
  return res.json() as Promise<T>
}

export function fetchUserMetrics (userid: number, opts?: FetchOptions): Promise<UserMetrics> {
  return getJson<UserMetrics>(`/api/users/${userid}/metrics`, opts)
}

export type WeightingArg = { strategy: 'uniform' | 'expdecay', alpha?: number } | undefined

function weightingToQuery (w: WeightingArg, leadingChar: '?' | '&' = '?'): string {
  const ww: { strategy: 'uniform' | 'expdecay', alpha?: number } = w ?? { strategy: 'expdecay', alpha: 0.95 }
  if (ww.strategy === 'uniform') {
    return `${leadingChar}weighting=uniform`
  }
  return `${leadingChar}weighting=expdecay&alpha=${ww.alpha ?? 0.95}`
}

export function fetchUserIndex (userid: number, weighting?: WeightingArg, opts?: FetchOptions): Promise<UserIndex> {
  return getJson<UserIndex>(`/api/users/${userid}/index${weightingToQuery(weighting)}`, opts)
}

export function fetchUserGames (userid: number, limit = 50, offset = 0, opts?: FetchOptions): Promise<UserGameLog> {
  return getJson<UserGameLog>(`/api/users/${userid}/games?limit=${limit}&offset=${offset}`, opts)
}

export function fetchGameMetrics (gameid: number, weighting?: WeightingArg, opts?: FetchOptions): Promise<GameMetrics> {
  return getJson<GameMetrics>(`/api/games/${gameid}/metrics${weightingToQuery(weighting)}`, opts)
}

export function fetchGameReplay (gameid: number, opts?: FetchOptions): Promise<GameReplay> {
  return getJson<GameReplay>(`/api/games/${gameid}/replay`, opts)
}

export function fetchLeaderboard (
  metric: LeaderboardMetric,
  limit = 50,
  weighting?: WeightingArg,
  opts?: FetchOptions,
): Promise<Leaderboard> {
  return getJson<Leaderboard>(`/api/leaderboard?metric=${metric}&limit=${limit}${weightingToQuery(weighting, '&')}`, opts)
}

// ---------- Search ----------

export interface PlayerSearchResult {
  id: number
  username: string
  pfp: string | null
  bio: string | null
  last_played: string | null
}

export function searchPlayers (q: string, opts?: FetchOptions): Promise<PlayerSearchResult[]> {
  return getJson<PlayerSearchResult[]>(`/api/users?q=${encodeURIComponent(q)}`, opts)
}

export interface GameSearchFilters {
  q?: string
  userid?: number
  before?: string
  after?: string
  winner?: 'resistance' | 'spy'
  outcomeType?: string
  minPlayers?: number
  maxPlayers?: number
  limit?: number
  offset?: number
}

export interface GameSearchRow {
  gameid: number
  endTimestamp: string
  startTimestamp: string | null
  winner: Winner
  outcomeType: string | null
  playerCount: number
  missionStatuses: boolean[]
  countFailedVotes: number
}

export interface GameSearch {
  rows: GameSearchRow[]
  total: number
  limit: number
  offset: number
}

export function searchGames (f: GameSearchFilters, opts?: FetchOptions): Promise<GameSearch> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v))
    }
  }
  return getJson<GameSearch>(`/api/games/search?${qs.toString()}`, opts)
}
