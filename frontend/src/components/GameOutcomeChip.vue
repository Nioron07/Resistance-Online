<template>
  <div class="outcome-chip" :class="chipClass">
    <span class="outcome-text">{{ text }}</span>
    <span v-if="reason" class="outcome-reason">{{ reason }}</span>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  const props = defineProps<{
    winner: 'resistance' | 'spies' | null
    /** Outcome reason (e.g., "Mission Victory", "Nomination Limit"). */
    reason?: string | null
  }>()

  const text = computed(() => {
    if (props.winner === 'resistance') return 'RESISTANCE WINS'
    if (props.winner === 'spies') return 'SPIES WIN'
    return 'IN PROGRESS'
  })

  const chipClass = computed(() => ({
    'outcome-resistance': props.winner === 'resistance',
    'outcome-spy': props.winner === 'spies',
    'outcome-neutral': props.winner === null,
  }))
</script>

<style scoped>
.outcome-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 18px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
  background-color: rgb(var(--v-theme-surface));
}
.outcome-text {
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: 0.06em;
}
.outcome-reason {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.outcome-resistance { border-color: var(--r-resistance); color: var(--r-resistance); }
.outcome-spy        { border-color: var(--r-spy);        color: var(--r-spy); }
.outcome-neutral    { color: var(--r-text-muted); }
@media (max-width: 600px) {
  .outcome-text  { font-size: 1.2rem; }
  .outcome-chip  { padding: 10px 14px; }
}
</style>
