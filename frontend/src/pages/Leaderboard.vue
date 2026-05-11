<template>
  <v-container class="r-leaderboard" max-width="1100">
    <header class="r-header">
      <h1 class="r-title">LEADERBOARD</h1>
    </header>

    <div class="r-tabs">
      <button
        v-for="t in tabs"
        :key="t.metric"
        class="r-tab"
        :class="{ 'r-tab-active': activeMetric === t.metric }"
        type="button"
        @click="setMetric(t.metric)"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="loading && rows.length === 0" class="r-loading">
      <v-progress-circular color="primary" indeterminate size="42" width="3" />
      <span class="r-loading-text">Loading leaderboard…</span>
    </div>

    <SideTable
      v-else
      :columns="columns"
      empty-text="Not enough games yet — play more to populate the board."
      :row-class="rowClass"
      :rows="rows"
      @row-click="goToProfile"
    >
      <template #cell.rank="{ row }">
        <span class="r-rank tabular-nums" :class="rankBadge(row.rank)">{{ row.rank }}</span>
      </template>

      <template #cell.player="{ row }">
        <div class="d-flex align-center">
          <v-avatar v-if="row.pfp" class="mr-2" :size="28">
            <v-img :src="row.pfp" />
          </v-avatar>

          <v-avatar v-else class="mr-2" color="surface-elevated" :size="28">
            <v-icon icon="mdi-account" size="small" />
          </v-avatar>

          <span>{{ row.username ?? `#${row.userid}` }}</span>
        </div>
      </template>

      <template #cell.value="{ row }">
        <span class="tabular-nums">{{ formatValue(row.value) }}</span>
      </template>

      <template #cell.games="{ row }">
        <span class="text-medium-emphasis tabular-nums">{{ row.games }}</span>
      </template>
    </SideTable>

    <div v-if="loading && rows.length > 0" class="r-status text-medium-emphasis">
      <v-progress-circular indeterminate size="14" width="2" /> updating…
    </div>
    <div v-if="error" class="r-status text-error">{{ error }}</div>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import SideTable from '@/components/SideTable.vue'
  import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardMetric } from '@/services/api'

  const router = useRouter()

  const tabs: Array<{ metric: LeaderboardMetric, label: string }> = [
    { metric: 'pIndex', label: 'OVERALL' },
    { metric: 'rIndex', label: 'RESISTANCE' },
    { metric: 'sIndex', label: 'SPY' },
    { metric: 'lifetimePoints', label: 'LIFETIME PTS' },
  ]

  const activeMetric = ref<LeaderboardMetric>('pIndex')
  const rows = ref<LeaderboardEntry[]>([])
  const loading = ref(false)
  const error = ref('')

  const isPoints = computed(() => activeMetric.value === 'lifetimePoints')

  const columns = computed(() => [
    { key: 'rank', label: '#', align: 'center' as const, width: '64px' },
    { key: 'player', label: 'PLAYER', align: 'left' as const },
    { key: 'value', label: isPoints.value ? 'POINTS' : 'INDEX', align: 'right' as const, width: '120px' },
    { key: 'games', label: 'GAMES', align: 'right' as const, width: '90px' },
  ])

  function setMetric (m: LeaderboardMetric) {
    if (activeMetric.value === m) return
    activeMetric.value = m
  }

  function formatValue (v: number): string {
    if (isPoints.value) return v.toString()
    return v.toFixed(2)
  }

  function rankBadge (rank: number): string {
    if (rank === 1) return 'r-rank-1'
    if (rank === 2) return 'r-rank-2'
    if (rank === 3) return 'r-rank-3'
    return ''
  }

  function rowClass (row: LeaderboardEntry): string {
    return row.rank <= 3 ? 'r-row-podium' : ''
  }

  function goToProfile (row: LeaderboardEntry) {
    if (row.username) router.push(`/Profile/${encodeURIComponent(row.username)}`)
  }

  async function load () {
    loading.value = true
    error.value = ''
    try {
      const r = await fetchLeaderboard(activeMetric.value, 50)
      rows.value = r.rows
    } catch (error_) {
      error.value = (error_ as Error).message
      rows.value = []
    } finally {
      loading.value = false
    }
  }

  watch(activeMetric, load)
  onMounted(load)
</script>

<style scoped>
.r-leaderboard { padding-top: 32px; padding-bottom: 48px; }
.r-header { margin-bottom: 24px; }
.r-title {
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: 0.04em;
  margin: 0;
}
.r-tabs {
  display: flex;
  flex-wrap: wrap;
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
  min-width: 120px;
}
.r-tab:hover  { color: rgb(var(--v-theme-on-surface)); }
.r-tab-active {
  background-color: rgb(var(--v-theme-surface-elevated));
  color: var(--r-resistance);
}

.r-rank {
  display: inline-block;
  width: 28px;
  height: 28px;
  line-height: 28px;
  border-radius: 50%;
  text-align: center;
  font-weight: 500;
}
.r-rank-1 { background-color: rgba(245, 158, 11, 0.18); color: #f59e0b; }
.r-rank-2 { background-color: rgba(148, 163, 184, 0.18); color: #94a3b8; }
.r-rank-3 { background-color: rgba(180, 83,  9,  0.18); color: #d97706; }
.r-row-podium { /* hover affordance only — color comes from rank badge */ }

.r-status {
  text-align: center;
  padding: 16px;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
</style>
