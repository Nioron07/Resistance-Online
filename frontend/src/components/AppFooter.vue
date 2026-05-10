<template>
  <v-footer app class="r-footer" :elevation="0">
    <div class="r-footer-inner">
      <span class="r-footer-brand">RESISTANCE-ONLINE</span>
      <span class="r-footer-sep">·</span>
      <span class="r-footer-year">© {{ year }}</span>
      <span class="r-footer-sep d-none d-sm-inline">·</span>
      <span class="r-footer-version d-none d-sm-inline">v1.0</span>
    </div>
  </v-footer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  const year = computed(() => new Date().getFullYear())
</script>

<style scoped>
.r-footer {
  background-color: rgb(var(--v-theme-background)) !important;
  border-top: 1px solid rgb(var(--v-theme-border));
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  text-transform: uppercase;
}
.r-footer-inner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.r-footer-brand {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
}
</style>
