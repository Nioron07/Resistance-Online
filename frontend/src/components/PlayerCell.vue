<template>
  <div class="r-player-row d-flex align-center">
    <img v-if="avatar" alt="" class="r-player-avatar" :src="avatar">
    <div v-else class="r-player-avatar r-player-avatar-fallback">{{ initials }}</div>

    <div class="r-player-stack">
      <span class="r-player-name" :title="username">{{ username }}</span>
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
/* min-width:0 lets the stack shrink inside flex/grid cells so long
   usernames ellipsize instead of overflowing ballot/mission/table cells —
   this component is the app's most reused overflow vector. */
.r-player-row   { min-width: 0; }
.r-player-stack { display: flex; flex-direction: column; min-width: 0; }
.r-player-name  {
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.r-player-role  { font-size: 0.65rem; letter-spacing: 0.08em; }
.r-player-avatar { flex: 0 0 auto; }
</style>
