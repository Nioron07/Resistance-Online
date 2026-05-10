<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script lang="ts" setup>
  // Auth + first-login redirects are handled by the global router guard
  // in `router/index.ts`. This component intentionally has no logic.
</script>
