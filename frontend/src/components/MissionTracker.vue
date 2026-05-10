<template>
  <div class="mission-tracker">
    <div
      v-for="(o, i) in normalized"
      :key="i"
      class="mission-circle"
      :class="circleClass(o)"
    >
      <span class="mission-index">{{ i + 1 }}</span>
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
  }>(), { dense: false })

  const normalized = computed(() => {
    const out: Array<boolean | null> = []
    for (let i = 0; i < 5; i++) out.push(props.outcomes[i] ?? null)
    return out
  })

  function circleClass (o: boolean | null) {
    return {
      'circle-success': o === true,
      'circle-fail': o === false,
      'circle-pending': o === null,
      'circle-dense': props.dense,
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
.mission-index { font-variant-numeric: tabular-nums; }
</style>
