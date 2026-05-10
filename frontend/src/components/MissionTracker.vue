<template>
  <div class="mission-tracker">
    <div
      v-for="(o, i) in normalized"
      :key="i"
      class="mission-circle"
      :class="circleClass(o, i)"
      :title="tooltip(i)"
    >
      <span class="mission-index">{{ label(i) }}</span>
      <span v-if="needsTwoFails(i)" aria-label="requires two fails" class="mission-twofail">2F</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  const props = withDefaults(defineProps<{
    /** 5 entries; true = success, false = fail, null/undefined = pending. */
    outcomes: ReadonlyArray<boolean | null | undefined>
    /** Compact rendering for mobile / inline use. */
    dense?: boolean
    /**
     * When provided, circles show the team size for each mission instead
     * of the mission index, and missions that require two fails (mission 4
     * with 7+ players) get an explicit indicator.
     */
    playerCount?: number | null
  }>(), { dense: false, playerCount: null })

  const MISSION_SIZES: Record<number, [number, number, number, number, number]> = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5],
  }

  const sizes = computed(() => {
    const pc = props.playerCount ?? 0
    return MISSION_SIZES[pc] ?? null
  })

  const normalized = computed(() => {
    const out: Array<boolean | null> = []
    for (let i = 0; i < 5; i++) out.push(props.outcomes[i] ?? null)
    return out
  })

  function label (i: number): string {
    return sizes.value ? String(sizes.value[i]) : String(i + 1)
  }

  function needsTwoFails (i: number): boolean {
    return i === 3 && (props.playerCount ?? 0) >= 7
  }

  function tooltip (i: number): string {
    if (!sizes.value) return `Mission ${i + 1}`
    const base = `Mission ${i + 1} — ${sizes.value[i]} players`
    return needsTwoFails(i) ? `${base} (requires 2 fails)` : base
  }

  function circleClass (o: boolean | null, i: number) {
    return {
      'circle-success': o === true,
      'circle-fail': o === false,
      'circle-pending': o === null,
      'circle-dense': props.dense,
      'circle-twofail': needsTwoFails(i),
    }
  }
</script>

<style scoped>
.mission-tracker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.mission-circle {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid rgb(var(--v-theme-border));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface-muted));
  transition: all 200ms ease-out;
}
.circle-dense  { width: 18px; height: 18px; font-size: 0.65rem; border-width: 1px; }
.circle-success { border-color: var(--r-resistance); background-color: rgba(59, 130, 246, 0.18); color: var(--r-resistance); }
.circle-fail    { border-color: var(--r-spy);        background-color: rgba(239,  68,  68, 0.18); color: var(--r-spy); }
.circle-pending { opacity: 0.55; }
.circle-twofail {
  border-style: double;
  border-width: 3px;
}
.mission-index { font-variant-numeric: tabular-nums; }
.mission-twofail {
  position: absolute;
  top: -6px;
  right: -8px;
  background-color: var(--r-warning, rgb(245, 158, 11));
  color: rgb(10, 14, 20);
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 1px 4px;
  border-radius: 6px;
  line-height: 1;
}
.circle-dense .mission-twofail {
  top: -5px;
  right: -6px;
  font-size: 0.45rem;
  padding: 0 3px;
}
</style>
