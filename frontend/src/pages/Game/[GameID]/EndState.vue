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

    <!-- Mobile: tabs to switch between R / S -->
    <div v-if="smAndDown" class="r-mobile-tabs">
      <button
        class="r-mobile-tab"
        :class="{ 'r-mobile-tab-active': mobileSide === 'resistance', 'r-mobile-tab-resistance': mobileSide === 'resistance' }"
        type="button"
        @click="mobileSide = 'resistance'"
      >
        RESISTANCE
      </button>

      <button
        class="r-mobile-tab"
        :class="{ 'r-mobile-tab-active': mobileSide === 'spy', 'r-mobile-tab-spy': mobileSide === 'spy' }"
        type="button"
        @click="mobileSide = 'spy'"
      >
        SPY
      </button>
    </div>

    <!-- Tables side-by-side desktop, single (selected) mobile -->
    <section class="r-tables-grid">
      <article
        v-if="!smAndDown || mobileSide === 'resistance'"
        class="r-team-card side-resistance"
      >
        <h2 class="r-team-title r-team-title-resistance">RESISTANCE</h2>

        <SideTable
          :columns="columns"
          empty-text="No resistance metrics."
          :row-class="(r) => r.userid === myUserid ? 'side-row-me' : ''"
          :rows="resistanceRows"
        >
          <template #cell.player="{ row }">
            <PlayerCell :avatar="row.pfp" :role="row.role" :username="row.username ?? `#${row.userid}`" />
          </template>

          <template #cell.points="{ row }">
            <span class="tabular-nums" :class="row.points > 0 ? 'text-success' : row.points < 0 ? 'text-error' : ''">
              {{ row.points > 0 ? '+' : '' }}{{ row.points }}
            </span>
          </template>

          <template #cell.delta="{ row }">
            <IndexBadge :value="row.indexDelta.pIndex" />
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

      <article
        v-if="!smAndDown || mobileSide === 'spy'"
        class="r-team-card side-spy"
      >
        <h2 class="r-team-title r-team-title-spy">SPY</h2>

        <SideTable
          :columns="columns"
          empty-text="No spy metrics."
          :row-class="(r) => r.userid === myUserid ? 'side-row-me' : ''"
          :rows="spyRows"
        >
          <template #cell.player="{ row }">
            <PlayerCell :avatar="row.pfp" :role="row.role" :username="row.username ?? `#${row.userid}`" />
          </template>

          <template #cell.points="{ row }">
            <span class="tabular-nums" :class="row.points > 0 ? 'text-success' : row.points < 0 ? 'text-error' : ''">
              {{ row.points > 0 ? '+' : '' }}{{ row.points }}
            </span>
          </template>

          <template #cell.delta="{ row }">
            <IndexBadge :value="row.indexDelta.pIndex" />
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

    <!-- Footer actions -->
    <footer class="r-end-footer">
      <v-btn color="primary" size="large" variant="flat" @click="router.push('/')">
        RETURN HOME
      </v-btn>

      <v-btn class="ml-2" variant="text" @click="copyShareLink">
        COPY SHARE LINK
      </v-btn>

      <span v-if="copied" class="ml-2 text-medium-emphasis">copied</span>
      <span v-if="data" class="r-catalog-badge">CATALOG v{{ data.details.catalogVersion }}</span>
    </footer>

    <div v-if="error" class="r-error">{{ error }}</div>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import BreakdownPanel from '@/components/BreakdownPanel.vue'
  import GameOutcomeChip from '@/components/GameOutcomeChip.vue'
  import IndexBadge from '@/components/IndexBadge.vue'
  import MissionTracker from '@/components/MissionTracker.vue'
  import PlayerCell from '@/components/PlayerCell.vue'
  import SideTable from '@/components/SideTable.vue'
  import { fetchGameMetrics, type GameMetrics } from '@/services/api'
  import { useAppStore } from '@/stores/app'

  const route = useRoute()
  const router = useRouter()
  const { smAndDown } = useDisplay()
  const appStore = useAppStore()
  const myUserid = computed(() => appStore.user?.id ?? null)

  const data = ref<GameMetrics | null>(null)
  const error = ref('')
  const expandedPlayer = ref<number | null>(null)
  const mobileSide = ref<'resistance' | 'spy'>('resistance')
  const copied = ref(false)

  /**
   * Per-side rows sorted by points descending. Stable secondary sort by
   * userid so two players with equal points always appear in the same
   * order across renders (and across the R/S panels).
   */
  function sortByPoints<T extends { points: number, userid: number }> (rows: T[]): T[] {
    return [...rows].sort((a, b) => b.points - a.points || a.userid - b.userid)
  }
  const resistanceRows = computed(() => sortByPoints(data.value?.teams.resistance.players ?? []))
  const spyRows        = computed(() => sortByPoints(data.value?.teams.spy.players ?? []))

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

  const columns = [
    { key: 'player', label: 'PLAYER', align: 'left' as const },
    { key: 'points', label: 'PTS', align: 'right' as const, width: '90px' },
    { key: 'delta', label: 'Δ INDEX', align: 'right' as const, width: '110px' },
    { key: 'complex', label: 'COMPLEX', align: 'right' as const, width: '90px' },
    { key: 'breakdown', label: '', align: 'right' as const, width: '40px', stackedHide: true },
  ]

  function toggleBreakdown (userid: number) {
    expandedPlayer.value = expandedPlayer.value === userid ? null : userid
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
      return
    }
    try {
      data.value = await fetchGameMetrics(Number(gameid.value))
    } catch (error_) {
      error.value = (error_ as Error).message
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

.r-mobile-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  padding: 4px;
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
}
.r-mobile-tab {
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
.r-mobile-tab-active     { background-color: rgb(var(--v-theme-surface-elevated)); }
.r-mobile-tab-resistance { color: var(--r-resistance); }
.r-mobile-tab-spy        { color: var(--r-spy); }

.r-tables-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 960px) { .r-tables-grid { grid-template-columns: 1fr; } }

.r-team-card {
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  padding: 16px;
}
.r-team-title {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  margin: 0 0 12px;
  font-weight: 500;
}
.r-team-title-resistance { color: var(--r-resistance); }
.r-team-title-spy        { color: var(--r-spy); }

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

.r-error { margin-top: 16px; text-align: center; color: var(--r-spy); font-size: 0.875rem; }

/* Highlight the signed-in player's row in both team tables. */
:deep(.side-row-me) {
  background-color: rgba(245, 158, 11, 0.08) !important;
  outline: 1px solid rgba(245, 158, 11, 0.45);
  outline-offset: -1px;
}
:deep(.side-row-card.side-row-me) {
  border-color: rgba(245, 158, 11, 0.55) !important;
  background-color: rgba(245, 158, 11, 0.08) !important;
}
</style>
