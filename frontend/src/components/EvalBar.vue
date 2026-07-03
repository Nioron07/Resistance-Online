<template>
  <div class="r-eval">
    <span class="r-eval-label r-eval-label-resistance">RESISTANCE</span>

    <div class="r-eval-track" :title="tooltip">
      <div class="r-eval-fill" :style="{ width: `${fillPct}%` }" />
      <div class="r-eval-center" />
      <span class="r-eval-value tabular-nums" :class="valueClass">
        {{ valueText }}
      </span>
    </div>

    <span class="r-eval-label r-eval-label-spy">SPY</span>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    /** Cumulative resistance − spy point differential at the current step. */
    differential: number
    /** Largest |differential| across the whole game — sets the bar's scale. */
    maxAbs: number
  }>()

  /**
   * Fraction of the track filled blue (resistance). 50% = even. Scaled so
   * the game's own extreme swing maps to ~95% / ~5% — the bar never quite
   * saturates, mirroring how chess eval bars behave.
   */
  const fillPct = computed(() => {
    const scale = Math.max(props.maxAbs, 1)
    const t = Math.max(-1, Math.min(1, props.differential / scale))
    return 50 + t * 45
  })

  const valueText = computed(() => {
    const d = props.differential
    if (d === 0) return '0'
    return `${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}`
  })

  const valueClass = computed(() =>
    props.differential > 0 ? 'r-eval-value-resistance'
    : props.differential < 0 ? 'r-eval-value-spy' : '')

  const tooltip = computed(() =>
    `Cumulative point differential: ${valueText.value} (positive = resistance ahead)`)
</script>

<style scoped>
.r-eval {
  display: flex;
  align-items: center;
  gap: 10px;
}
.r-eval-label {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  white-space: nowrap;
}
.r-eval-label-resistance { color: var(--r-resistance); }
.r-eval-label-spy        { color: var(--r-spy); }

.r-eval-track {
  position: relative;
  flex: 1;
  height: 16px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
  background-color: rgba(239, 68, 68, 0.28); /* spy side shows through */
  overflow: hidden;
}
.r-eval-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: rgba(59, 130, 246, 0.55);
  transition: width 350ms ease-out;
}
.r-eval-center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: rgb(var(--v-theme-border));
}
.r-eval-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface));
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
}
</style>
