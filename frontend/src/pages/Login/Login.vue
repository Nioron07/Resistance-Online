<template>
  <v-card
    class="mx-auto my-8"
    elevation="4"
    max-width="500"
    width="90%"
  >
    <v-card-item>
      <v-card-title class="text-center text-h4">
        Login
      </v-card-title>
    </v-card-item>

    <v-container class="d-flex flex-wrap align-center justify-center ga-3">
      <v-card-actions>
        <v-btn append-icon="mdi-steam" variant="outlined" @click="appStore.loginWithSteam()">
          Steam
        </v-btn>
      </v-card-actions>
    </v-container>
  </v-card>
</template>

<script setup lang="ts">
  import { useAppStore } from '@/stores/app'
  const appStore = useAppStore()
</script>
