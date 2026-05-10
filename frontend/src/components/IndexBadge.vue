<template>
  <span class="index-badge tabular-nums" :class="signClass">
    <v-icon v-if="value !== null && value !== 0" :icon="iconName" size="x-small" />
    <span>{{ formatted }}</span>
  </span>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  const props = withDefaults(defineProps<{
    value: number | null
    precision?: number
    /** Show a leading + on positive values. */
    showPlus?: boolean
  }>(), {
    precision: 2,
    showPlus: true,
  })

  const formatted = computed(() => {
    if (props.value === null || !Number.isFinite(props.value)) return '—'
    const fixed = props.value.toFixed(props.precision)
    if (props.showPlus && props.value > 0) return `+${fixed}`
    return fixed
  })

  const signClass = computed(() => {
    if (props.value === null) return 'index-neutral'
    if (props.value > 0) return 'index-up'
    if (props.value < 0) return 'index-down'
    return 'index-neutral'
  })

  const iconName = computed(() => {
    if (props.value === null) return ''
    if (props.value > 0) return 'mdi-arrow-up-thin'
    if (props.value < 0) return 'mdi-arrow-down-thin'
    return 'mdi-minus'
  })
</script>

<style scoped>
.index-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.95em;
}
.index-up      { color: var(--r-success); }
.index-down    { color: var(--r-spy); }
.index-neutral { color: var(--r-text-muted); }
</style>
