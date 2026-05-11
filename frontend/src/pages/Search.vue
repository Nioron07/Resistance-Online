<template>
  <v-container class="r-search" max-width="1100">
    <header class="r-header">
      <h1 class="r-title">SEARCH</h1>
    </header>

    <!-- Tab switcher mirrors the Leaderboard's .r-tab pattern. -->
    <div class="r-tabs">
      <button
        class="r-tab"
        :class="{ 'r-tab-active': activeTab === 'player' }"
        type="button"
        @click="setTab('player')"
      >
        PLAYER
      </button>

      <button
        class="r-tab"
        :class="{ 'r-tab-active': activeTab === 'game' }"
        type="button"
        @click="setTab('game')"
      >
        GAME
      </button>
    </div>

    <!-- ========== PLAYER TAB ========== -->
    <section v-if="activeTab === 'player'">
      <v-text-field
        v-model="playerQ"
        clearable
        density="comfortable"
        hide-details
        placeholder="Username"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
      />

      <div v-if="playerLoading" class="r-loading">
        <v-progress-circular color="primary" indeterminate size="36" width="3" />
        <span class="r-loading-text">Searching players…</span>
      </div>

      <SideTable
        v-else-if="playerQ"
        class="mt-3"
        :columns="playerColumns"
        empty-text="No players match that query."
        :rows="playerResults"
        @row-click="goToPlayer"
      >
        <template #cell.player="{ row }">
          <div class="d-flex align-center">
            <v-avatar v-if="row.pfp" class="mr-2" :size="32">
              <v-img :src="row.pfp" />
            </v-avatar>

            <v-avatar v-else class="mr-2" color="surface-elevated" :size="32">
              <v-icon icon="mdi-account" size="small" />
            </v-avatar>

            <div>
              <div class="r-result-name">{{ row.username }}</div>
              <div v-if="row.bio" class="r-result-sub">{{ row.bio }}</div>
            </div>
          </div>
        </template>

        <template #cell.last_played="{ row }">
          <span class="text-medium-emphasis tabular-nums">{{ formatDate(row.last_played) }}</span>
        </template>
      </SideTable>

      <div v-else class="r-empty-hint">Type a username to search.</div>
    </section>

    <!-- ========== GAME TAB ========== -->
    <section v-else>
      <div class="r-filters">
        <div class="r-filter-row">
          <v-text-field
            v-model="gameFilters.q"
            class="r-filter-grow"
            clearable
            density="comfortable"
            hide-details
            label="Contains player (username)"
            prepend-inner-icon="mdi-account-search"
            variant="outlined"
          />
        </div>

        <div class="r-filter-row">
          <v-text-field
            v-model="gameFilters.after"
            density="comfortable"
            hide-details
            label="Played after"
            type="date"
            variant="outlined"
          />

          <v-text-field
            v-model="gameFilters.before"
            density="comfortable"
            hide-details
            label="Played before"
            type="date"
            variant="outlined"
          />
        </div>

        <div class="r-filter-row">
          <div class="r-pill-group">
            <span class="r-filter-label">WINNER</span>

            <button
              class="r-pill"
              :class="{ 'r-pill-active': !gameFilters.winner }"
              type="button"
              @click="gameFilters.winner = undefined"
            >ANY</button>

            <button
              class="r-pill r-pill-resistance"
              :class="{ 'r-pill-active-resistance': gameFilters.winner === 'resistance' }"
              type="button"
              @click="gameFilters.winner = 'resistance'"
            >RESISTANCE</button>

            <button
              class="r-pill r-pill-spy"
              :class="{ 'r-pill-active-spy': gameFilters.winner === 'spy' }"
              type="button"
              @click="gameFilters.winner = 'spy'"
            >SPY</button>
          </div>
        </div>

        <div class="r-filter-row">
          <v-select
            v-model="gameFilters.outcomeType"
            clearable
            density="comfortable"
            hide-details
            :items="OUTCOME_TYPES"
            label="Outcome type"
            variant="outlined"
          />

          <v-text-field
            v-model.number="gameFilters.minPlayers"
            density="comfortable"
            hide-details
            label="Min players"
            max="10"
            min="5"
            type="number"
            variant="outlined"
          />

          <v-text-field
            v-model.number="gameFilters.maxPlayers"
            density="comfortable"
            hide-details
            label="Max players"
            max="10"
            min="5"
            type="number"
            variant="outlined"
          />
        </div>

        <div class="r-filter-actions">
          <span class="r-filter-meta tabular-nums">
            {{ gameLoading ? 'searching…' : `${gameTotal} result${gameTotal === 1 ? '' : 's'}` }}
          </span>

          <v-btn size="small" variant="text" @click="resetGameFilters">RESET</v-btn>
        </div>
      </div>

      <div v-if="gameLoading && gameResults.length === 0" class="r-loading">
        <v-progress-circular color="primary" indeterminate size="36" width="3" />
        <span class="r-loading-text">Searching games…</span>
      </div>

      <SideTable
        v-else
        class="mt-3"
        :columns="gameColumns"
        empty-text="No games match these filters."
        :rows="gameResults"
        @row-click="goToGame"
      >
        <template #cell.endTimestamp="{ row }">
          <span class="text-medium-emphasis">{{ formatDate(row.endTimestamp) }}</span>
        </template>

        <template #cell.gameid="{ row }">#{{ row.gameid }}</template>

        <template #cell.winner="{ row }">
          <span class="r-winner-badge" :class="winnerClass(row.winner)">
            {{ winnerLabel(row.winner) }}
          </span>
        </template>

        <template #cell.outcome="{ row }">
          <span class="text-medium-emphasis">{{ formatOutcomeType(row.outcomeType) }}</span>
        </template>

        <template #cell.players="{ row }">
          <span class="tabular-nums">{{ row.playerCount }}</span>
        </template>

        <template #cell.missions="{ row }">
          <MissionTracker dense :outcomes="row.missionStatuses" :player-count="row.playerCount" />
        </template>

        <template #cell.replay="{ row }">
          <v-btn
            density="compact"
            icon="mdi-play-circle"
            size="small"
            variant="text"
            @click.stop="router.push(`/Game/${row.gameid}/Replay`)"
          />
        </template>
      </SideTable>
    </section>

    <div v-if="error" class="r-error">{{ error }}</div>
  </v-container>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import MissionTracker from '@/components/MissionTracker.vue'
  import SideTable from '@/components/SideTable.vue'
  import {
    type GameSearchFilters,
    type GameSearchRow,
    type PlayerSearchResult,
    searchGames,
    searchPlayers,
  } from '@/services/api'

  type Tab = 'player' | 'game'

  /**
   * Outcome strings emitted by `ResistanceCore.ts` today. Hard-coded
   * because Postgres doesn't expose them as an enum. Update this when a
   * new outcome reason is added server-side.
   */
  const OUTCOME_TYPES = [
    { title: 'Mission Victory', value: 'mission-victory' },
    { title: 'Nomination Limit', value: 'nomination-limit' },
  ]

  const route = useRoute()
  const router = useRouter()

  const activeTab = ref<Tab>(((route.query.tab as Tab) === 'game') ? 'game' : 'player')

  // ----- Player tab state -----
  const playerQ = ref<string>((route.query.q as string) ?? '')
  const playerResults = ref<PlayerSearchResult[]>([])
  const playerLoading = ref(false)
  const error = ref('')

  const playerColumns = [
    { key: 'player', label: 'PLAYER', align: 'left' as const },
    { key: 'last_played', label: 'LAST PLAYED', align: 'right' as const, width: '180px' },
  ]

  // ----- Game tab state -----
  const gameFilters = reactive<GameSearchFilters>({
    q: (route.query.gq as string) ?? undefined,
    before: (route.query.before as string) ?? undefined,
    after: (route.query.after as string) ?? undefined,
    winner: (route.query.winner as 'resistance' | 'spy' | undefined) ?? undefined,
    outcomeType: (route.query.outcomeType as string) ?? undefined,
    minPlayers: route.query.minPlayers ? Number(route.query.minPlayers) : undefined,
    maxPlayers: route.query.maxPlayers ? Number(route.query.maxPlayers) : undefined,
  })
  const gameResults = ref<GameSearchRow[]>([])
  const gameTotal = ref(0)
  const gameLoading = ref(false)

  const gameColumns = [
    { key: 'endTimestamp', label: 'PLAYED', align: 'left' as const, width: '170px' },
    { key: 'gameid', label: 'GAME', align: 'left' as const, width: '80px' },
    { key: 'winner', label: 'WINNER', align: 'left' as const, width: '110px' },
    { key: 'outcome', label: 'OUTCOME', align: 'left' as const, width: '160px' },
    { key: 'players', label: 'P', align: 'right' as const, width: '50px' },
    { key: 'missions', label: 'MISSIONS', align: 'left' as const },
    { key: 'replay', label: '', align: 'right' as const, width: '40px', stackedHide: true },
  ]

  // ----- Debounce helper -----
  /**
   * Trailing-edge debounce. We share one timeout token across both
   * search-fire paths so rapid tab-switches + edits don't pile up.
   */
  let debounceToken: ReturnType<typeof setTimeout> | null = null
  function debounce (fn: () => void, ms = 300) {
    if (debounceToken) clearTimeout(debounceToken)
    debounceToken = setTimeout(fn, ms)
  }

  // ----- Player search -----
  async function runPlayerSearch () {
    const q = (playerQ.value ?? '').trim()
    if (!q) {
      playerResults.value = []
      return
    }
    playerLoading.value = true
    error.value = ''
    try {
      playerResults.value = await searchPlayers(q)
    } catch (error_) {
      error.value = (error_ as Error).message
      playerResults.value = []
    } finally {
      playerLoading.value = false
    }
  }

  // ----- Game search -----
  async function runGameSearch () {
    gameLoading.value = true
    error.value = ''
    try {
      const payload = normalizeFilters(gameFilters)
      const res = await searchGames(payload)
      gameResults.value = res.rows
      gameTotal.value = res.total
    } catch (error_) {
      error.value = (error_ as Error).message
      gameResults.value = []
      gameTotal.value = 0
    } finally {
      gameLoading.value = false
    }
  }

  /**
   * Convert the in-form values to the API payload shape:
   *  - empty strings/zeros become undefined so the URLSearchParams builder
   *    drops them (the backend's IS NULL guards expect missing params, not
   *    empty strings).
   *  - date inputs are converted to ISO timestamps at start-of-day UTC.
   */
  function normalizeFilters (f: GameSearchFilters): GameSearchFilters {
    return {
      q: f.q || undefined,
      before: f.before ? toIso(f.before) : undefined,
      after: f.after ? toIso(f.after) : undefined,
      winner: f.winner || undefined,
      outcomeType: f.outcomeType || undefined,
      minPlayers: typeof f.minPlayers === 'number' && f.minPlayers >= 5 ? f.minPlayers : undefined,
      maxPlayers: typeof f.maxPlayers === 'number' && f.maxPlayers >= 5 ? f.maxPlayers : undefined,
    }
  }

  function toIso (dateStr: string): string {
    // Browsers' <input type="date"> returns YYYY-MM-DD.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return `${dateStr}T00:00:00Z`
    return dateStr
  }

  function resetGameFilters () {
    gameFilters.q = undefined
    gameFilters.before = undefined
    gameFilters.after = undefined
    gameFilters.winner = undefined
    gameFilters.outcomeType = undefined
    gameFilters.minPlayers = undefined
    gameFilters.maxPlayers = undefined
  }

  // ----- Reactive triggers -----
  watch(playerQ, () => debounce(runPlayerSearch, 250))
  watch(
    () => ({ ...gameFilters }),
    () => debounce(runGameSearch, 300),
    { deep: true },
  )

  // ----- URL sync -----
  /**
   * Mirror state into the URL so reloads and shareable links preserve a
   * search. Using `router.replace` keeps the back button useful (one entry
   * per top-level navigation, not per keystroke).
   */
  function syncUrl () {
    const q: Record<string, string> = { tab: activeTab.value }
    if (activeTab.value === 'player' && playerQ.value) q.q = playerQ.value
    if (activeTab.value === 'game') {
      if (gameFilters.q) q.gq = gameFilters.q
      if (gameFilters.before) q.before = gameFilters.before
      if (gameFilters.after) q.after = gameFilters.after
      if (gameFilters.winner) q.winner = gameFilters.winner
      if (gameFilters.outcomeType) q.outcomeType = gameFilters.outcomeType
      if (gameFilters.minPlayers) q.minPlayers = String(gameFilters.minPlayers)
      if (gameFilters.maxPlayers) q.maxPlayers = String(gameFilters.maxPlayers)
    }
    router.replace({ path: '/Search', query: q })
  }
  watch(activeTab, syncUrl)
  watch(playerQ, syncUrl)
  watch(() => ({ ...gameFilters }), syncUrl, { deep: true })

  function setTab (t: Tab) {
    if (activeTab.value === t) return
    activeTab.value = t
    // Re-run the active search so results are present when arriving on the tab.
    if (t === 'game' && gameResults.value.length === 0 && !gameLoading.value) {
      runGameSearch()
    }
  }

  function goToPlayer (row: PlayerSearchResult) {
    if (row.username) router.push(`/Profile/${encodeURIComponent(row.username)}`)
  }
  function goToGame (row: GameSearchRow) {
    router.push(`/Game/${row.gameid}/EndState`)
  }

  // ----- Formatters -----
  function formatDate (s: string | null): string {
    if (!s) return '—'
    try {
      return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return s
    }
  }
  function formatOutcomeType (t: string | null | undefined): string {
    if (!t) return '—'
    return t.replaceAll('-', ' ').toUpperCase()
  }
  function winnerLabel (w: 'resistance' | 'spies' | null): string {
    if (w === 'resistance') return 'RESISTANCE'
    if (w === 'spies') return 'SPIES'
    return '—'
  }
  function winnerClass (w: 'resistance' | 'spies' | null): string {
    if (w === 'resistance') return 'r-winner-resistance'
    if (w === 'spies') return 'r-winner-spy'
    return ''
  }

  onMounted(() => {
    if (playerQ.value) runPlayerSearch()
    if (activeTab.value === 'game') runGameSearch()
  })
</script>

<style scoped>
.r-search { padding-top: 32px; padding-bottom: 48px; }
.r-header { margin-bottom: 16px; }
.r-title {
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  margin: 0;
}

.r-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  padding: 4px;
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
}
.r-tab {
  flex: 1;
  background: transparent;
  border: 0;
  padding: 8px 12px;
  font-family: var(--r-mono);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  cursor: pointer;
  border-radius: 6px;
  transition: all 200ms ease-out;
}
.r-tab:hover  { color: rgb(var(--v-theme-on-surface)); }
.r-tab-active {
  background-color: rgb(var(--v-theme-surface-elevated));
  color: var(--r-resistance);
}

.r-filters {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.r-filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.r-filter-row > * { flex: 1 1 180px; }
.r-filter-grow { flex: 1 1 100%; }

.r-filter-label {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
  align-self: center;
  margin-right: 8px;
}

.r-pill-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.r-pill {
  background: transparent;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  cursor: pointer;
  transition: all 200ms ease-out;
}
.r-pill:hover { color: rgb(var(--v-theme-on-surface)); }
.r-pill-active {
  background-color: rgb(var(--v-theme-surface-elevated));
  color: rgb(var(--v-theme-on-surface));
}
.r-pill-resistance { color: var(--r-resistance); border-color: rgba(59, 130, 246, 0.4); }
.r-pill-active-resistance {
  background-color: rgba(59, 130, 246, 0.18);
  border-color: var(--r-resistance);
}
.r-pill-spy { color: var(--r-spy); border-color: rgba(239, 68, 68, 0.4); }
.r-pill-active-spy {
  background-color: rgba(239, 68, 68, 0.18);
  border-color: var(--r-spy);
}

.r-filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid rgba(31, 41, 55, 0.4);
}
.r-filter-meta {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  text-transform: uppercase;
}

.r-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 12px;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-loading-text {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.r-empty-hint {
  margin-top: 24px;
  text-align: center;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-muted));
}

.r-result-name { font-size: 0.95rem; }
.r-result-sub  { font-size: 0.7rem; color: rgb(var(--v-theme-on-surface-muted)); }

.r-winner-badge {
  display: inline-block;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
}
.r-winner-resistance { color: var(--r-resistance); border-color: rgba(59, 130, 246, 0.5); }
.r-winner-spy        { color: var(--r-spy);        border-color: rgba(239, 68, 68, 0.5); }

.r-error {
  margin-top: 16px;
  text-align: center;
  color: var(--r-spy);
  font-size: 0.875rem;
}
</style>
