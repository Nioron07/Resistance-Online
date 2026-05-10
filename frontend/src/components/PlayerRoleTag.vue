<template>
  <span class="role-tag" :class="tagClass">{{ label }}</span>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  const SPY_ROLES = new Set(['spy', 'assassin', 'false-commander', 'deep-cover', 'blind-spy'])

  const props = defineProps<{
    role?: string | null
    /** When true, shows "RESISTANCE" / "SPY" instead of the specific role. */
    sideOnly?: boolean
  }>()

  const isSpy = computed(() => props.role !== null && props.role !== undefined && SPY_ROLES.has(props.role))

  const label = computed(() => {
    if (!props.role) return 'UNKNOWN'
    if (props.sideOnly) return isSpy.value ? 'SPY' : 'RESISTANCE'
    return props.role.toUpperCase().replaceAll('-', ' ')
  })

  const tagClass = computed(() => ({
    'role-spy': isSpy.value,
    'role-resistance': props.role !== null && props.role !== undefined && !isSpy.value,
    'role-unknown': !props.role,
  }))
</script>

<style scoped>
.role-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  font-weight: 500;
  white-space: nowrap;
}
.role-resistance { color: var(--r-resistance); border-color: rgba(59, 130, 246, 0.5); background-color: rgba(59, 130, 246, 0.08); }
.role-spy        { color: var(--r-spy);        border-color: rgba(239,  68,  68, 0.5); background-color: rgba(239,  68,  68, 0.08); }
.role-unknown    { color: var(--r-text-muted); border-color: rgb(var(--v-theme-border)); }
</style>
