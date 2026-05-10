<template>
  <v-card class="metric-card r-card-hover pa-4" :class="sideClass">
    <div class="metric-label text-caption text-uppercase">
      {{ label }}
    </div>

    <div class="metric-value tabular-nums" :class="valueColorClass">
      {{ formattedValue }}
    </div>

    <div v-if="hint" class="metric-hint text-caption">
      {{ hint }}
    </div>

    <div v-if="delta !== undefined && delta !== null" class="metric-delta tabular-nums" :class="deltaClass">
      <v-icon :icon="delta >= 0 ? 'mdi-arrow-up-thin' : 'mdi-arrow-down-thin'" size="small" />
      <span>{{ formatDelta(delta) }}</span>
    </div>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  const props = withDefaults(defineProps<{
    label: string
    value: number | string | null
    hint?: string
    /** Optional change indicator (e.g., index delta from a game). */
    delta?: number | null
    /** Decimal places for numeric values; ignored for strings. */
    precision?: number
    /** Visual side accent. */
    side?: 'resistance' | 'spy' | 'neutral'
    /** Color the value itself based on sign. */
    colorValueBySign?: boolean
  }>(), {
    precision: 2,
    side: 'neutral',
    colorValueBySign: false,
  })

  const formattedValue = computed(() => {
    if (props.value === null || props.value === undefined) return '—'
    if (typeof props.value === 'number') {
      if (!Number.isFinite(props.value)) return '—'
      return props.value.toFixed(props.precision)
    }
    return String(props.value)
  })

  const valueColorClass = computed(() => {
    if (!props.colorValueBySign || typeof props.value !== 'number') return ''
    if (props.value > 0) return 'text-success'
    if (props.value < 0) return 'text-error'
    return ''
  })

  const sideClass = computed(() => ({
    'side-resistance': props.side === 'resistance',
    'side-spy': props.side === 'spy',
  }))

  const deltaClass = computed(() => {
    if (props.delta === undefined || props.delta === null) return ''
    if (props.delta > 0) return 'text-success'
    if (props.delta < 0) return 'text-error'
    return 'text-medium-emphasis'
  })

  function formatDelta (n: number): string {
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(props.precision)}`
  }
</script>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: rgb(var(--v-theme-surface));
  min-height: 110px;
}
.metric-label {
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.08em;
}
.metric-value {
  font-size: 2rem;
  font-weight: 300;
  line-height: 1.1;
  margin-top: 4px;
}
.metric-hint {
  color: rgb(var(--v-theme-on-surface-muted));
  margin-top: 2px;
}
.metric-delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: auto;
  font-size: 0.875rem;
}
</style>
