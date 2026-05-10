<template>
  <AppNav v-if="!isGameRoute" />

  <v-main>
    <router-view />
  </v-main>

  <AppFooter v-if="!isGameRoute" />
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import AppFooter from '@/components/AppFooter.vue'
  import AppNav from '@/components/AppNav.vue'

  const route = useRoute()
  /**
   * Game pages are full-bleed with their own translucent app bar; skip the
   * global nav + footer there to avoid double-stacking.
   */
  const isGameRoute = computed(() => route.path.startsWith('/Game/'))
</script>
