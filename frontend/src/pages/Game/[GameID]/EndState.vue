<template>
  <v-container class="r-end" max-width="1200">
    <!-- Header strip -->
    <header class="r-end-header">
      <GameOutcomeChip
        :reason="formatOutcomeType(data?.outcome.outcomeType)"
        :winner="data?.outcome.winner ?? null"
      />

      <div class="r-end-header-right">
        <MissionTracker :outcomes="data?.outcome.missionStatuses ?? []" :player-count="endStatePlayerCount" />

        <div class="r-end-totals">
          <span class="r-team-total r-team-total-resistance tabular-nums">
            R · {{ data?.teams.resistance.totalPoints ?? '—' }}
          </span>

          <span class="r-team-total r-team-total-spy tabular-nums">
            S · {{ data?.teams.spy.totalPoints ?? '—' }}
          </span>
        </div>
      </div>
    </header>

    <!-- Loading state replaces the team panels entirely. -->
    <div v-if="loading" class="r-loading">
      <v-progress-circular color="primary" indeterminate size="42" width="3" />
      <span class="r-loading-text">Loading game metrics…</span>
    </div>

    <!-- Stacked R / S panels — Resistance on top, Spies on bottom. -->
    <section v-else-if="data" class="r-tables-stack">
      <article class="r-team-card side-resistance">
        <header class="r-team-card-header">
          <h2 class="r-team-title r-team-title-resistance">RESISTANCE</h2>

          <span class="r-team-card-meta tabular-nums">
            {{ data.teams.resistance.players.length }} PLAYERS ·
            {{ data.teams.resistance.totalPoints }} PTS
          </span>
        </header>

        <SideTable
          :columns="columnsForSide('resistance')"
          empty-text="No resistance metrics."
          :row-class="rowClassFor"
          :rows="resistanceRows"
        >
          <template #cell.player="{ row }">
            <PlayerCell :avatar="row.pfp" :role="row.role" :username="row.username ?? `#${row.userid}`" />
          </template>

          <template #cell.points="{ row }">
            <span class="tabular-nums" :class="pointsClass(row.points)">
              {{ row.points > 0 ? '+' : '' }}{{ row.points }}
            </span>
          </template>

          <template #cell.delta="{ row }">
            <IndexBadge :value="row.indexDelta.pIndex" />
          </template>

          <template #cell.nominated="{ row }">
            <span class="tabular-nums">{{ row.stats.timesNominated }}</span>
          </template>

          <template #cell.missions="{ row }">
            <span class="tabular-nums">{{ row.stats.missionsParticipated }}</span>
          </template>

          <template #cell.led="{ row }">
            <span class="tabular-nums">{{ row.stats.timesLed }}</span>
          </template>

          <template #cell.votes="{ row }">
            <span class="tabular-nums r-vote-cell">
              <span class="text-success">{{ row.stats.timesApproved }}</span>
              <span class="r-vote-sep">/</span>
              <span class="text-error">{{ row.stats.timesRejected }}</span>
            </span>
          </template>

          <template #cell.complex="{ row }">
            <span class="tabular-nums">{{ formatComplex(row.complexMetric.value) }}</span>
          </template>

          <template #cell.breakdown="{ row }">
            <v-btn
              density="compact"
              :icon="expandedPlayer === row.userid ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              size="x-small"
              variant="text"
              @click.stop="toggleBreakdown(row.userid)"
            />
          </template>

          <template #afterRow="{ row }">
            <BreakdownPanel
              v-if="expandedPlayer === row.userid"
              :breakdown="row.breakdown"
            />
          </template>
        </SideTable>
      </article>

      <article class="r-team-card side-spy">
        <header class="r-team-card-header">
          <h2 class="r-team-title r-team-title-spy">SPY</h2>

          <span class="r-team-card-meta tabular-nums">
            {{ data.teams.spy.players.length }} PLAYERS ·
            {{ data.teams.spy.totalPoints }} PTS
          </span>
        </header>

        <SideTable
          :columns="columnsForSide('spy')"
          empty-text="No spy metrics."
          :row-class="rowClassFor"
          :rows="spyRows"
        >
          <template #cell.player="{ row }">
            <PlayerCell :avatar="row.pfp" :role="row.role" :username="row.username ?? `#${row.userid}`" />
          </template>

          <template #cell.points="{ row }">
            <span class="tabular-nums" :class="pointsClass(row.points)">
              {{ row.points > 0 ? '+' : '' }}{{ row.points }}
            </span>
          </template>

          <template #cell.delta="{ row }">
            <IndexBadge :value="row.indexDelta.pIndex" />
          </template>

          <template #cell.nominated="{ row }">
            <span class="tabular-nums">{{ row.stats.timesNominated }}</span>
          </template>

          <template #cell.missions="{ row }">
            <span class="tabular-nums">{{ row.stats.missionsParticipated }}</span>
          </template>

          <template #cell.led="{ row }">
            <span class="tabular-nums">{{ row.stats.timesLed }}</span>
          </template>

          <template #cell.votes="{ row }">
            <span class="tabular-nums r-vote-cell">
              <span class="text-success">{{ row.stats.timesApproved }}</span>
              <span class="r-vote-sep">/</span>
              <span class="text-error">{{ row.stats.timesRejected }}</span>
            </span>
          </template>

          <template #cell.cards="{ row }">
            <span class="tabular-nums r-vote-cell">
              <span class="text-success">{{ row.stats.successCardsPlayed }}</span>
              <span class="r-vote-sep">/</span>
              <span class="text-error">{{ row.stats.failCardsPlayed }}</span>
            </span>
          </template>

          <template #cell.complex="{ row }">
            <span class="tabular-nums">{{ formatComplex(row.complexMetric.value) }}</span>
          </template>

          <template #cell.breakdown="{ row }">
            <v-btn
              density="compact"
              :icon="expandedPlayer === row.userid ? 'mdi-chevron-up' : 'mdi-chevron-down'"
              size="x-small"
              variant="text"
              @click.stop="toggleBreakdown(row.userid)"
            />
          </template>

          <template #afterRow="{ row }">
            <BreakdownPanel
              v-if="expandedPlayer === row.userid"
              :breakdown="row.breakdown"
            />
          </template>
        </SideTable>
      </article>
    </section>

    <!-- Footer actions. Spacing comes from the flex gap alone — per-button
         margins double up when the row wraps on small screens. -->
    <footer v-if="!loading" class="r-end-footer">
      <v-btn color="primary" size="large" variant="flat" @click="router.push('/')">
        RETURN HOME
      </v-btn>

      <v-btn
        v-if="myProfileHref"
        prepend-icon="mdi-account"
        size="large"
        variant="tonal"
        @click="router.push(myProfileHref)"
      >
        MY METRICS
      </v-btn>

      <v-btn
        prepend-icon="mdi-play-circle"
        size="large"
        variant="tonal"
        @click="router.push(`/Game/${gameid}/Replay`)"
      >
        REPLAY GAME
      </v-btn>

      <v-btn variant="text" @click="copyShareLink">
        COPY SHARE LINK
      </v-btn>

      <span v-if="copied" class="text-medium-emphasis">copied</span>
      <span v-if="data" class="r-catalog-badge">CATALOG v{{ data.details.catalogVersion }}</span>
    </footer>

    <div v-if="error" class="r-error">{{ error }}</div>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import BreakdownPanel from '@/components/BreakdownPanel.vue'
  import GameOutcomeChip from '@/components/GameOutcomeChip.vue'
  import IndexBadge from '@/components/IndexBadge.vue'
  import MissionTracker from '@/components/MissionTracker.vue'
  import PlayerCell from '@/components/PlayerCell.vue'
  import SideTable from '@/components/SideTable.vue'
  import { fetchGameMetrics, type GameMetrics, type GamePlayerMetrics } from '@/services/api'
  import { useAppStore } from '@/stores/app'
  import { useGameStore } from '@/stores/game'

  const route = useRoute()
  const router = useRouter()
  const appStore = useAppStore()
  const gameStore = useGameStore()

  /**
   * appStore.user.id arrives as a string at runtime because the backend
   * serializes BIGINT columns as strings to avoid 53-bit precision loss.
   * The metrics endpoint, by contrast, casts userids back to numbers via
   * Number(row.user_id). Compare as Number on both sides so the
   * highlight matches regardless of which form the data arrives in.
   */
  const myUserid = computed(() => {
    const raw = appStore.user?.id
    if (raw === null || raw === undefined) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  })

  const data = ref<GameMetrics | null>(null)
  const error = ref('')
  const loading = ref(true)
  const expandedPlayer = ref<number | null>(null)
  const copied = ref(false)

  function sortByPoints (rows: GamePlayerMetrics[]): GamePlayerMetrics[] {
    return rows.toSorted((a, b) => b.points - a.points || a.userid - b.userid)
  }
  const resistanceRows = computed(() => sortByPoints(data.value?.teams.resistance.players ?? []))
  const spyRows = computed(() => sortByPoints(data.value?.teams.spy.players ?? []))

  const endStatePlayerCount = computed(() => {
    const r = data.value?.teams.resistance.players.length ?? 0
    const s = data.value?.teams.spy.players.length ?? 0
    const total = r + s
    return total > 0 ? total : null
  })

  const gameid = computed(() => {
    const v = route.params.GameID ?? route.params.gameID
    return Array.isArray(v) ? v[0] : v
  })

  const myProfileHref = computed(() => {
    const u = appStore.user?.username
    return u ? `/Profile/${encodeURIComponent(u)}` : null
  })

  /**
   * Column sets — one variant per side. The resistance variant ends with
   * RoS (Rate of Sherlock); the spy variant ends with RoI (Rate of
   * Illusion) and adds a cards-played column. Both share the simple
   * counting columns up front so they read consistently side-by-side.
   * On mobile, secondary columns collapse via `stackedHide` so the
   * vertical-card layout doesn't get unwieldy.
   */
  function columnsForSide (side: 'resistance' | 'spy') {
    const base = [
      { key: 'player', label: 'PLAYER', align: 'left' as const },
      { key: 'points', label: 'PTS', align: 'right' as const, width: '70px' },
      { key: 'delta', label: 'Δ INDEX', align: 'right' as const, width: '90px' },
      { key: 'missions', label: 'MISSIONS', align: 'right' as const, width: '80px', stackedHide: false },
      { key: 'nominated', label: 'NOMS', align: 'right' as const, width: '70px', stackedHide: true },
      { key: 'led', label: 'LED', align: 'right' as const, width: '60px', stackedHide: true },
      { key: 'votes', label: 'VOTES (✓/✗)', align: 'right' as const, width: '110px', stackedHide: true },
    ]
    if (side === 'spy') {
      base.push({ key: 'cards', label: 'CARDS (✓/✗)', align: 'right' as const, width: '110px', stackedHide: true })
    }
    base.push(
      { key: 'complex', label: side === 'resistance' ? 'RoS' : 'RoI', align: 'right' as const, width: '70px', stackedHide: false },
      // Action column must stay visible in the stacked mobile view —
      // hiding it made point breakdowns unreachable on phones.
      { key: 'breakdown', label: 'BREAKDOWN', align: 'right' as const, width: '40px', stackedHide: false },
    )
    return base
  }

  function rowClassFor (row: GamePlayerMetrics): string {
    return myUserid.value !== null && row.userid === myUserid.value ? 'side-row-me' : ''
  }

  function toggleBreakdown (userid: number) {
    expandedPlayer.value = expandedPlayer.value === userid ? null : userid
  }

  function pointsClass (n: number) {
    return n > 0 ? 'text-success' : (n < 0 ? 'text-error' : '')
  }

  function formatComplex (v: number | null): string {
    if (v === null) return '—'
    return v.toFixed(2)
  }

  function formatOutcomeType (t: string | null | undefined): string {
    if (!t) return ''
    return t.replaceAll('-', ' ').toUpperCase()
  }

  async function copyShareLink () {
    const url = `${window.location.origin}/Game/${gameid.value}/EndState`
    try {
      await navigator.clipboard.writeText(url)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 1500)
    } catch (error_) {
      error.value = (error_ as Error).message
    }
  }

  onMounted(async () => {
    if (!gameid.value) {
      error.value = 'No game id'
      loading.value = false
      return
    }
    loading.value = true
    try {
      const fetched = await fetchGameMetrics(Number(gameid.value))
      data.value = fetched
      // Populate the surrounding [GameID] layout (mission tracker, R/S
      // counts) from the historical payload — no socket required.
      gameStore.loadFromMetrics(fetched)
    } catch (error_) {
      error.value = (error_ as Error).message
    } finally {
      loading.value = false
    }
  })
</script>

<style scoped>
.r-end { padding-top: 24px; padding-bottom: 48px; }

.r-end-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}
.r-end-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.r-end-totals { display: flex; gap: 12px; }
.r-team-total {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
}
.r-team-total-resistance { color: var(--r-resistance); border-color: rgba(59, 130, 246, 0.5); }
.r-team-total-spy        { color: var(--r-spy);        border-color: rgba(239,  68,  68, 0.5); }

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

.r-tables-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.r-team-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  padding: 16px;
}
.r-team-card-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.r-team-title {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  margin: 0;
  font-weight: 500;
}
.r-team-title-resistance { color: var(--r-resistance); }
.r-team-title-spy        { color: var(--r-spy); }
.r-team-card-meta {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
}

.r-vote-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.r-vote-sep { color: rgb(var(--v-theme-on-surface-muted)); }

.r-end-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}
.r-catalog-badge {
  margin-left: auto;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  border: 1px solid rgb(var(--v-theme-border));
  padding: 2px 8px;
  border-radius: 4px;
}
@media (max-width: 600px) {
  /* When the footer wraps, auto-margin makes the badge jump around —
     let it flow with the rest instead. */
  .r-catalog-badge { margin-left: 0; }
}

.r-error { margin-top: 16px; text-align: center; color: var(--r-spy); font-size: 0.875rem; }

/* Highlight the signed-in player's row in both team tables. */
:deep(.side-row-me) {
  background-color: rgba(245, 158, 11, 0.12) !important;
  outline: 1px solid rgba(245, 158, 11, 0.55);
  outline-offset: -1px;
}
:deep(.side-row-me td) {
  background-color: transparent !important;
}
:deep(.side-row-card.side-row-me) {
  border-color: rgba(245, 158, 11, 0.55) !important;
  background-color: rgba(245, 158, 11, 0.12) !important;
}
</style>
