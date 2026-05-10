<template>
  <div class="d-flex align-center">
    <img v-if="avatar" alt="" class="r-player-avatar" :src="avatar">
    <div v-else class="r-player-avatar r-player-avatar-fallback">{{ initials }}</div>

    <div class="r-player-stack">
      <span class="r-player-name">{{ username }}</span>
      <span class="r-player-role text-medium-emphasis">{{ roleDisplay }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = withDefaults(defineProps<{
    username: string
    avatar?: string | null
    role?: string
  }>(), { avatar: null, role: '' })

  const initials = computed(() => (props.username || '?').slice(0, 2).toUpperCase())
  const roleDisplay = computed(() => (props.role ?? '').toUpperCase().replaceAll('-', ' '))
</script>

<style scoped>
.r-player-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: rgb(var(--v-theme-surface-elevated));
}
.r-player-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-player-stack { display: flex; flex-direction: column; }
.r-player-name  { font-size: 0.875rem; }
.r-player-role  { font-size: 0.65rem; letter-spacing: 0.08em; }
</style>
