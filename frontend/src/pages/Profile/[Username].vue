<template>
  <v-container class="r-profile" max-width="1200">
    <header class="r-profile-header">
      <div class="d-flex align-center">
        <v-avatar v-if="profile?.pfp" class="mr-3" size="56">
          <v-img :src="profile.pfp" />
        </v-avatar>

        <v-avatar v-else class="mr-3" color="surface-elevated" size="56">
          <v-icon icon="mdi-account" />
        </v-avatar>

        <div>
          <h1 class="r-profile-name">{{ usernameDisplay }}</h1>

          <p class="r-profile-meta">
            <span v-if="metrics">
              {{ metrics.counts.games }} GAMES · {{ metrics.counts.wins }}W · {{ metrics.counts.losses }}L
            </span>
          </p>
        </div>
      </div>
    </header>

    <!-- Headline indices + lifetime points -->
    <section class="r-grid-headline">
      <MetricCard
        :delta="null"
        hint="(R + S) / 2"
        label="P-INDEX"
        :precision="2"
        side="neutral"
        :value="indexBundle?.pIndex ?? null"
      />

      <MetricCard
        hint="resistance games"
        label="R-INDEX"
        :precision="2"
        side="resistance"
        :value="indexBundle?.rIndex ?? null"
      />

      <MetricCard
        hint="spy games"
        label="S-INDEX"
        :precision="2"
        side="spy"
        :value="indexBundle?.sIndex ?? null"
      />

      <MetricCard
        color-value-by-sign
        :hint="lifetimeHint"
        label="LIFETIME PTS"
        :precision="0"
        side="neutral"
        :value="metrics?.lifetimePoints.total ?? null"
      />
    </section>

    <!-- Resistance / Spy split -->
    <section class="r-grid-split">
      <v-card class="r-split-card r-card-hover side-resistance pa-5">
        <h2 class="r-split-title">RESISTANCE</h2>

        <div class="r-split-grid">
          <MetricCard hint="rate of sherlock" label="RoS_L" :precision="3" :value="metrics?.resistance.RoS_L ?? null" />
          <MetricCard hint="rate of CD" label="RoCD_L" :precision="3" :value="metrics?.resistance.RoCD_L ?? null" />
          <MetricCard color-value-by-sign label="LIFETIME PTS" :precision="0" :value="metrics?.lifetimePoints.resistance ?? null" />
          <MetricCard label="GAMES" :precision="0" :value="metrics?.counts.gamesAsResistance ?? null" />
        </div>
      </v-card>

      <v-card class="r-split-card r-card-hover side-spy pa-5">
        <h2 class="r-split-title r-split-title-spy">SPY</h2>

        <div class="r-split-grid">
          <MetricCard hint="rate of illusion" label="RoI_L" :precision="3" :value="metrics?.spy.RoI_L ?? null" />
          <MetricCard hint="rate of infiltration" label="RoIF_L" :precision="3" :value="metrics?.spy.RoIF_L ?? null" />
          <MetricCard color-value-by-sign label="LIFETIME PTS" :precision="0" :value="metrics?.lifetimePoints.spy ?? null" />
          <MetricCard label="GAMES" :precision="0" :value="metrics?.counts.gamesAsSpy ?? null" />
        </div>
      </v-card>
    </section>

    <!-- Game log -->
    <section class="r-game-log">
      <header class="r-game-log-header">
        <h2 class="r-section-title">GAME LOG</h2>
        <span v-if="gameLog" class="r-section-meta">{{ gameLog.total }} GAMES</span>
      </header>

      <SideTable
        :columns="logColumns"
        empty-text="No completed games yet."
        :rows="gameLog?.rows ?? []"
        @row-click="(r) => router.push(`/Game/${r.gameid}/EndState`)"
      >
        <template #cell.endTimestamp="{ row }">
          <span class="text-medium-emphasis">{{ formatDate(row.endTimestamp) }}</span>
        </template>

        <template #cell.gameid="{ row }">#{{ row.gameid }}</template>

        <template #cell.side="{ row }">
          <PlayerRoleTag :role="row.role" side-only />
        </template>

        <template #cell.points="{ row }">
          <span class="tabular-nums" :class="row.points > 0 ? 'text-success' : row.points < 0 ? 'text-error' : ''">
            {{ row.points > 0 ? '+' : '' }}{{ row.points }}
          </span>
        </template>

        <template #cell.won="{ row }">
          <span :class="row.won ? 'text-success' : 'text-error'">
            {{ row.won === null ? '—' : row.won ? 'WIN' : 'LOSS' }}
          </span>
        </template>

        <template #cell.missions="{ row }">
          <MissionTracker dense :outcomes="row.missionStatuses" />
        </template>
      </SideTable>

      <div class="r-game-log-footer">
        <v-btn
          v-if="hasMore"
          :loading="loadingMore"
          variant="text"
          @click="loadMore"
        >
          LOAD MORE
        </v-btn>
      </div>
    </section>

    <div v-if="error" class="r-error">{{ error }}</div>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import MetricCard from '@/components/MetricCard.vue'
  import MissionTracker from '@/components/MissionTracker.vue'
  import PlayerRoleTag from '@/components/PlayerRoleTag.vue'
  import SideTable from '@/components/SideTable.vue'
  import {
    fetchUserGames,
    fetchUserIndex,
    fetchUserMetrics,
    type UserGameLog,
    type UserIndex,
    type UserMetrics,
  } from '@/services/api'
  import { useAppStore } from '@/stores/app'

  const route = useRoute()
  const router = useRouter()
  const appStore = useAppStore()

  const usernameRaw = computed(() => {
    const v = route.params.Username ?? route.params.username
    return Array.isArray(v) ? v[0] : v ?? ''
  })

  const userid = ref<number | null>(null)
  const profile = ref<{ pfp: string | null } | null>(null)
  const metrics = ref<UserMetrics | null>(null)
  const indexBundle = ref<UserIndex | null>(null)
  const gameLog = ref<UserGameLog | null>(null)

  const loadingMore = ref(false)
  const error = ref('')

  const usernameDisplay = computed(() => usernameRaw.value || 'Unknown player')
  const lifetimeHint = computed(() => {
    if (!metrics.value) return ''
    return `R ${metrics.value.lifetimePoints.resistance} · S ${metrics.value.lifetimePoints.spy}`
  })

  const logColumns = [
    { key: 'endTimestamp', label: 'PLAYED', align: 'left' as const, width: '180px' },
    { key: 'gameid', label: 'GAME', align: 'left' as const, width: '90px' },
    { key: 'side', label: 'SIDE', align: 'left' as const, width: '120px' },
    { key: 'points', label: 'POINTS', align: 'right' as const, width: '90px' },
    { key: 'won', label: 'RESULT', align: 'left' as const, width: '90px' },
    { key: 'missions', label: 'MISSIONS', align: 'left' as const },
  ]

  const hasMore = computed(() => {
    if (!gameLog.value) return false
    return gameLog.value.rows.length < gameLog.value.total
  })

  function formatDate (s: string): string {
    try {
      return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return s
    }
  }

  /**
   * Resolve the route's username → userid.
   * Strategy:
   *   1. If it matches the logged-in user, use appStore.user.id.
   *   2. Otherwise, fall back to /api/users (verbosity=0) and find by username.
   */
  async function resolveUserid (username: string): Promise<number | null> {
    await appStore.fetchUser()
    if (appStore.user?.username === username && appStore.user?.id != null) {
      return appStore.user.id
    }
    try {
      const res = await fetch('/api/users?verbosity=0', { credentials: 'include' })
      if (!res.ok) return null
      const arr = (await res.json()) as Array<{ id: number, username: string, pfp: string | null }>
      const match = arr.find(u => u.username === username)
      if (match) {
        profile.value = { pfp: match.pfp }
        return match.id
      }
    } catch { /* fall through */ }
    return null
  }

  async function loadAll (id: number) {
    error.value = ''
    try {
      const [m, idx, log] = await Promise.all([
        fetchUserMetrics(id),
        fetchUserIndex(id),
        fetchUserGames(id, 50, 0),
      ])
      metrics.value = m
      indexBundle.value = idx
      gameLog.value = log
    } catch (error_) {
      error.value = (error_ as Error).message
    }
  }

  async function loadMore () {
    if (!gameLog.value || !userid.value) return
    loadingMore.value = true
    try {
      const next = await fetchUserGames(userid.value, 50, gameLog.value.rows.length)
      gameLog.value = {
        ...next,
        rows: [...gameLog.value.rows, ...next.rows],
      }
    } catch (error_) {
      error.value = (error_ as Error).message
    } finally {
      loadingMore.value = false
    }
  }

  async function init () {
    const id = await resolveUserid(usernameRaw.value)
    if (id === null) {
      error.value = `No player found for "${usernameRaw.value}"`
      return
    }
    userid.value = id
    if (appStore.user?.id === id) {
      profile.value = { pfp: appStore.user?.pfp ?? null }
    }
    await loadAll(id)
  }

  watch(() => usernameRaw.value, init)
  onMounted(init)
</script>

<style scoped>
.r-profile { padding-top: 24px; padding-bottom: 48px; }
.r-profile-header { margin-bottom: 24px; }
.r-profile-name {
  font-size: 1.75rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  margin: 0;
}
.r-profile-meta {
  margin: 0;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.06em;
}

.r-grid-headline {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
@media (max-width: 960px) { .r-grid-headline { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .r-grid-headline { grid-template-columns: 1fr; } }

.r-grid-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}
@media (max-width: 960px) { .r-grid-split { grid-template-columns: 1fr; } }
.r-split-card {
  background-color: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgb(var(--v-theme-border)) !important;
}
.r-split-title {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--r-resistance);
  margin: 0 0 16px;
  font-weight: 500;
}
.r-split-title-spy { color: var(--r-spy); }
.r-split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 480px) { .r-split-grid { grid-template-columns: 1fr; } }

.r-game-log-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.r-section-title {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
  margin: 0;
  font-weight: 500;
}
.r-section-meta { font-size: 0.7rem; letter-spacing: 0.08em; color: rgb(var(--v-theme-on-surface-muted)); }
.r-game-log-footer { display: flex; justify-content: center; padding: 12px; }
.r-error {
  margin-top: 16px;
  text-align: center;
  color: var(--r-spy);
  font-size: 0.875rem;
}
</style>
