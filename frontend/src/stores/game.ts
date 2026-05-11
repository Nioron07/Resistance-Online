import type {
  GamePhase,
  KnownRole,
  PlayerId,
  RoleName,
} from '@/types/gameEvents'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import bg5 from '@/assets/5_Players.png'
import bg6 from '@/assets/6_Players.png'
import bg7 from '@/assets/7_Players.png'
import bg8 from '@/assets/8_Players.png'
import bg9 from '@/assets/9_Players.png'
import bg10 from '@/assets/10_Players.png'
import { GameSocket } from '@/services/gameSocket'

const API_BASE = ''

const backgrounds: Record<number, string> = {
  5: bg5, 6: bg6, 7: bg7, 8: bg8, 9: bg9, 10: bg10,
}

// Mirror of backend getRulesFor — keeps the lobby UI (team tracker, spy count) live.
const RULES: Record<number, { spyCount: number, missionSizes: [number, number, number, number, number] }> = {
  5: { spyCount: 2, missionSizes: [2, 3, 2, 3, 3] },
  6: { spyCount: 2, missionSizes: [2, 3, 4, 3, 4] },
  7: { spyCount: 3, missionSizes: [2, 3, 3, 4, 4] },
  8: { spyCount: 3, missionSizes: [3, 4, 4, 5, 5] },
  9: { spyCount: 3, missionSizes: [3, 4, 4, 5, 5] },
  10: { spyCount: 4, missionSizes: [3, 4, 4, 5, 5] },
}

interface PlayerProfile {
  username: string
  avatar?: string
}

export const useGameStore = defineStore('game', () => {
  const router = useRouter()
  const socket = new GameSocket()

  // identity
  const myId = ref<PlayerId | null>(null)

  // room / phase
  const joinCode = ref<string>('')
  const phase = ref<GamePhase>('lobby')

  // players
  const playerIds = ref<PlayerId[]>([])
  const playerProfiles = ref<Record<PlayerId, PlayerProfile>>({})
  const hostId = ref<PlayerId | null>(null)

  // game flow
  const leaderId = ref<PlayerId | null>(null)
  const mission = ref(0)
  const round = ref(0)
  const nominatedTeam = ref<PlayerId[]>([])
  const votesReceived = ref<PlayerId[]>([])
  const lastVoteResult = ref<{ votes: Record<PlayerId, boolean>, approved: boolean } | null>(null)
  const missionOutcomes = ref<string[]>(['transparent', 'transparent', 'transparent', 'transparent', 'transparent'])
  const myRole = ref<RoleName | null>(null)
  const knownRoles = ref<Record<PlayerId, KnownRole> | undefined>(undefined)
  const winner = ref<'resistance' | 'spies' | null>(null)
  const endReason = ref('')

  let handlersRegistered = false

  // derived
  const playerCount = computed(() => playerIds.value.length)
  const isHost = computed(() => myId.value !== null && hostId.value !== null && hostId.value === myId.value)
  const amLeader = computed(() => myId.value !== null && myId.value === leaderId.value)
  const amOnTeam = computed(() => myId.value !== null && nominatedTeam.value.includes(myId.value))

  const rules = computed(() => RULES[playerCount.value])
  const numSpies = computed(() => rules.value?.spyCount ?? 0)
  const numResistance = computed(() => playerCount.value - numSpies.value)
  const teamSizes = computed<Record<number, number>>(() => {
    const sizes = rules.value?.missionSizes ?? [2, 3, 2, 3, 3]
    return { 1: sizes[0], 2: sizes[1], 3: sizes[2], 4: sizes[3], 5: sizes[4] }
  })
  const currTeamSize = computed(() => rules.value?.missionSizes[mission.value] ?? 0)
  const backgroundImage = computed(() => backgrounds[playerCount.value] ?? bg7)

  const playerNames = computed(() => playerIds.value.map(id => playerProfiles.value[id]?.username ?? `Player ${id}`))
  const leaderName = computed(() => (leaderId.value === null ? '' : playerProfiles.value[leaderId.value]?.username ?? `Player ${leaderId.value}`))
  const nominatedTeamNames = computed(() => nominatedTeam.value.map(id => playerProfiles.value[id]?.username ?? `Player ${id}`))
  const phaseLabel = computed(() => {
    switch (phase.value) {
      case 'lobby': { return 'Lobby'
      }
      case 'role-reveal': { return 'Role Reveal'
      }
      case 'nomination': { return 'Team Selection'
      }
      case 'voting': { return 'Team Vote'
      }
      case 'suspicion': { return 'Suspicion'
      }
      case 'mission': { return 'Mission'
      }
      case 'game-over': { return 'Game Over'
      }
      default: { return phase.value
      }
    }
  })

  async function fetchSelf () {
    const res = await fetch(`${API_BASE}/auth/me?verbosity=1`, { credentials: 'include' })
    if (!res.ok) {
      return
    }
    const u = await res.json()
    myId.value = (u?.id ?? u?.userid) as PlayerId
    if (myId.value != null) {
      playerProfiles.value[myId.value] = { username: u.username, avatar: u.pfp }
    }
  }

  async function fetchProfile (id: PlayerId) {
    if (playerProfiles.value[id]) {
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}?verbosity=0`, { credentials: 'include' })
      if (!res.ok) {
        return
      }
      const u = await res.json()
      playerProfiles.value[id] = { username: u.username, avatar: u.pfp }
    } catch (error) {
      console.warn('failed to fetch profile', id, error)
    }
  }

  function registerHandlers () {
    if (handlersRegistered) {
      return
    }
    handlersRegistered = true

    socket.on('player:joined', async d => {
      playerIds.value = [...d.players]
      await Promise.all(d.players.map(id => fetchProfile(id)))
    })

    socket.on('player:left', d => {
      playerIds.value = playerIds.value.filter(id => id !== d.playerId)
    })

    /**
     * Server is the source of truth for seat order. Sent on every join,
     * leave, and host-initiated reorder.
     */
    socket.on('lobby:reordered', d => {
      playerIds.value = [...d.seatOrder]
      hostId.value = d.hostId
    })

    socket.on('game:started', () => {
      phase.value = 'role-reveal'
      router.push(`/Game/${joinCode.value}/IdentitySelection`)
    })

    socket.on('role:assigned', d => {
      myRole.value = d.role
      knownRoles.value = d.knownRoles
    })

    socket.on('nomination:started', d => {
      phase.value = 'nomination'
      leaderId.value = d.leaderId
      mission.value = d.mission
      round.value = d.round
      nominatedTeam.value = []
      lastVoteResult.value = null
      router.push(`/Game/${joinCode.value}/TeamSelection`)
    })

    socket.on('nomination:submitted', d => {
      nominatedTeam.value = [...d.team]
      phase.value = 'voting'
      votesReceived.value = []
      router.push(`/Game/${joinCode.value}/TeamVote`)
    })

    socket.on('vote:received', d => {
      if (!votesReceived.value.includes(d.playerId)) {
        votesReceived.value.push(d.playerId)
      }
    })

    socket.on('vote:result', d => {
      lastVoteResult.value = d
    })

    socket.on('suspicion:started', () => {
      phase.value = 'suspicion'
      router.push(`/Game/${joinCode.value}/SuspicionPhase`)
    })

    socket.on('mission:started', d => {
      phase.value = 'mission'
      mission.value = d.mission
      leaderId.value = d.leaderId
      nominatedTeam.value = [...d.team]
      router.push(`/Game/${joinCode.value}/MissionPhase`)
    })

    socket.on('mission:result', d => {
      const idx = mission.value
      if (idx >= 0 && idx < missionOutcomes.value.length) {
        missionOutcomes.value[idx] = d.result ? 'blue' : 'red'
      }
    })

    socket.on('game:ended', d => {
      phase.value = 'game-over'
      winner.value = d.winner
      endReason.value = d.reason
      router.push(`/Game/${joinCode.value}/EndState`)
    })

    socket.on('socket:error', d => {
      console.error('game socket error:', d.message)
    })

    // Sent by the backend on reconnect: full per-player state snapshot.
    // See backend/game/ResistanceGameRoom.ts addPlayer reconnect branch.
    socket.on('state:update', d => {
      try {
        applyServerState(JSON.parse(d.state))
      } catch (error) {
        console.error('failed to apply state:update', error)
      }
    })
  }

  function applyServerState (s: any) {
    if (!s) {
      return
    }

    phase.value = s.phase ?? phase.value
    mission.value = s.mission ?? 0
    round.value = s.round ?? 0
    leaderId.value = s.leaderId ?? null
    nominatedTeam.value = Array.isArray(s.nominatedTeam) ? [...s.nominatedTeam] : []

    if (s.players && typeof s.players === 'object') {
      const ids = Object.keys(s.players).map(Number) as PlayerId[]
      playerIds.value = ids
      // pull self role / known roles from the player record visible to me
      if (myId.value !== null) {
        const me = s.players[myId.value] ?? s.players[String(myId.value)]
        if (me) {
          myRole.value = (me.role ?? null) as RoleName | null
          knownRoles.value = me.knownRoles ?? undefined
        }
      }
      // Hydrate any missing profile rows for newly visible players
      for (const id of ids) {
        if (!playerProfiles.value[id]) {
          fetchProfile(id)
        }
      }
    }

    // Rebuild mission outcomes from completed missions
    const outcomes: string[] = ['transparent', 'transparent', 'transparent', 'transparent', 'transparent']
    if (Array.isArray(s.missions)) {
      for (const [i, m] of s.missions.entries()) {
        if (i < 5) {
          outcomes[i] = m?.success ? 'blue' : 'red'
        }
      }
    }
    missionOutcomes.value = outcomes

    winner.value = s.winner ?? null

    // Lost on disconnect; will be re-emitted by the next vote round if applicable.
    votesReceived.value = []
    lastVoteResult.value = null

    // Route the user to the page matching the current phase so a mid-game
    // refresh / reconnect lands them in the right place.
    const target = phaseRoute(phase.value)
    if (target) {
      router.push(`/Game/${joinCode.value}/${target}`)
    }
  }

  function phaseRoute (p: GamePhase): string | null {
    switch (p) {
      case 'lobby': { return 'Lobby'
      }
      case 'role-reveal': { return 'IdentitySelection'
      }
      case 'nomination': { return 'TeamSelection'
      }
      case 'voting': { return 'TeamVote'
      }
      case 'suspicion': { return 'SuspicionPhase'
      }
      case 'mission': { return 'MissionPhase'
      }
      case 'game-over': { return 'EndState'
      }
      default: { return null
      }
    }
  }

  async function connect (code: string) {
    if (joinCode.value === code && handlersRegistered) {
      return
    }
    joinCode.value = code
    resetGameState()
    await fetchSelf()
    registerHandlers()
    await socket.connect(code)
  }

  function disconnect () {
    socket.close()
    handlersRegistered = false
    resetGameState()
  }

  function resetGameState () {
    phase.value = 'lobby'
    playerIds.value = []
    leaderId.value = null
    mission.value = 0
    round.value = 0
    nominatedTeam.value = []
    votesReceived.value = []
    lastVoteResult.value = null
    missionOutcomes.value = ['transparent', 'transparent', 'transparent', 'transparent', 'transparent']
    myRole.value = null
    knownRoles.value = undefined
    winner.value = null
    endReason.value = ''
  }

  // client -> server actions
  function startGame () {
    if (playerIds.value.length < 5) {
      return
    }
    socket.send('game:start', {
      leaderId: playerIds.value[0]!,
      seatOrder: [...playerIds.value],
    })
  }

  function submitRole (role: RoleName) {
    socket.send('role:submit', { role })
  }

  function submitNomination (team: PlayerId[]) {
    socket.send('nomination:submit', { team })
  }

  function castVote (vote: boolean) {
    socket.send('vote:cast', { vote })
  }

  function submitSuspicions (sus: Record<PlayerId, number>) {
    socket.send('sus:submit', { sus })
  }

  function playMissionCard (card: boolean) {
    socket.send('mission:play-card', { card })
  }

  /**
   * Host-only: send the new lobby seat order to the server. The server
   * validates + broadcasts `lobby:reordered`, which updates every client
   * (including this one) via the listener above.
   */
  function reorderSeats (seatOrder: PlayerId[]) {
    socket.send('lobby:reorder', { seatOrder: [...seatOrder] })
  }

  /**
   * Hydrate the store from a historical metrics payload for the EndState
   * read-only view. No socket involved — just enough state for the
   * surrounding [GameID] layout (player count, spies/resistance counts,
   * mission tracker, phase label) to render correctly against an
   * already-finished game.
   */
  function loadFromMetrics (payload: {
    gameid: number | string
    teams: {
      resistance: { players: Array<{ userid: number, username: string | null, pfp: string | null }> }
      spy: { players: Array<{ userid: number, username: string | null, pfp: string | null }> }
    }
    outcome: { winner: 'resistance' | 'spies' | null, missionStatuses: Array<boolean | null> }
  }) {
    joinCode.value = String(payload.gameid)
    phase.value = 'game-over'
    const ids: PlayerId[] = []
    const profiles: Record<PlayerId, PlayerProfile> = {}
    for (const p of [...payload.teams.resistance.players, ...payload.teams.spy.players]) {
      ids.push(p.userid)
      profiles[p.userid] = {
        username: p.username ?? `Player ${p.userid}`,
        avatar: p.pfp ?? undefined,
      }
    }
    playerIds.value = ids
    playerProfiles.value = profiles
    missionOutcomes.value = [0, 1, 2, 3, 4].map(i => {
      const v = payload.outcome.missionStatuses[i]
      if (v === true) {
        return 'blue'
      }
      if (v === false) {
        return 'red'
      }
      return 'transparent'
    })
    winner.value = payload.outcome.winner === 'spies'
      ? 'spies'
      : (payload.outcome.winner === 'resistance' ? 'resistance' : null)
  }

  return {
    // identity
    myId,
    // room / phase
    joinCode, phase, phaseLabel,
    // players
    playerIds, playerProfiles, playerNames, playerCount,
    // host / leader
    isHost, hostId, leaderId, leaderName, amLeader,
    // game flow
    mission, round, nominatedTeam, nominatedTeamNames, amOnTeam,
    votesReceived, lastVoteResult,
    missionOutcomes, myRole, knownRoles,
    winner, endReason,
    // rules-derived
    rules, numSpies, numResistance, teamSizes, currTeamSize, backgroundImage,
    // actions
    connect, disconnect,
    startGame, submitRole, submitNomination, castVote, submitSuspicions, playMissionCard, reorderSeats,
    loadFromMetrics,
  }
})
