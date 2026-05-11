<template>
  <div v-if="entries.length === 0" class="r-breakdown-empty">no actions scored</div>

  <div v-else class="r-breakdown-panel">
    <div v-for="[key, val] in entries" :key="key" class="r-breakdown-row">
      <span class="r-breakdown-key">{{ labelFor(key) }}</span>

      <span
        class="r-breakdown-val tabular-nums"
        :class="val > 0 ? 'text-success' : val < 0 ? 'text-error' : ''"
      >{{ val > 0 ? '+' : '' }}{{ val }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    breakdown: Record<string, number>
  }>()

  /**
   * Maps the snake_case keys from the action-points catalog to short
   * human-readable phrases. Anything not in the map gets prettified
   * (snake_case → Title Case) as a fallback so unknown keys still read
   * reasonably without a code change.
   */
  const LABELS: Record<string, string> = {
    // Voting on a nomination
    approve_clean_team: 'Approved clean team',
    approve_dirty_team: 'Approved dirty team',
    reject_clean_team: 'Rejected clean team',
    reject_dirty_team: 'Rejected dirty team',
    // Mission outcome bonus
    approved_clean_succeeded: 'Clean team you approved succeeded',
    approved_dirty_failed: 'Dirty team you approved failed',
    approved_clean_failed: 'Clean team you approved failed',
    approved_dirty_succeeded: 'Dirty team you approved succeeded',
    // Mission team participation
    on_team_mission_succeeded: 'On mission — success',
    on_team_mission_failed: 'On mission — failure',
    played_fail_card: 'Played a fail card',
    played_success_when_failed: 'Played success on a failed mission',
    // Leadership
    led_clean_team: 'Led a clean team',
    led_dirty_team: 'Led a dirty team',
    led_dirty_team_approved: 'Led a dirty team that passed',
    // Suspicion — active
    suspicion_correct_per_gamma: 'Correct suspicions',
    suspicion_incorrect_per_gamma: 'Incorrect suspicions',
    // Suspicion — passive
    trusted_by_resistance_per_voter: 'Trusted by resistance',
    suspected_by_resistance_per_gamma: 'Suspected by resistance',
    // Game outcome
    game_won: 'Game won',
    game_lost: 'Game lost',
  }

  function labelFor (key: string): string {
    if (LABELS[key]) return LABELS[key]
    // Fallback: turn unknown_snake_case or camelCase into Title Case so
    // even pre-catalog data still renders something readable.
    const spaced = key
      .replaceAll('_', ' ')
      .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
  }

  const entries = computed(() =>
    Object.entries(props.breakdown).toSorted((a, b) => Math.abs(b[1]) - Math.abs(a[1])),
  )
</script>

<style scoped>
.r-breakdown-panel {
  background-color: rgb(var(--v-theme-surface-elevated));
  border-radius: 6px;
  padding: 8px 12px;
  margin: 4px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
}
.r-breakdown-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.r-breakdown-key {
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.02em;
}
.r-breakdown-empty {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-muted));
  font-style: italic;
  padding: 8px 0;
}
</style>
