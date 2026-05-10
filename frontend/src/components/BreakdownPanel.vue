<template>
  <div v-if="entries.length === 0" class="r-breakdown-empty">no actions scored</div>

  <div v-else class="r-breakdown-panel">
    <div v-for="[key, val] in entries" :key="key" class="r-breakdown-row">
      <span class="r-breakdown-key">{{ key }}</span>

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
  font-family: var(--r-mono);
  letter-spacing: 0.02em;
}
.r-breakdown-empty {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-muted));
  font-style: italic;
  padding: 8px 0;
}
</style>
