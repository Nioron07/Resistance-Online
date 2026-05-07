<template>
  <v-container class="py-8 d-flex flex-column align-center">
    <v-card class="pa-8 d-flex flex-column align-center" min-width="320">
      <v-card-title
        v-if="game.winner === 'spies'"
        class="text-h2"
        style="color: red"
      >
        Spies Win
      </v-card-title>

      <v-card-title
        v-else-if="game.winner === 'resistance'"
        class="text-h2"
        style="color: rgb(2, 100, 200)"
      >
        Resistance Wins
      </v-card-title>

      <v-card-title v-else class="text-h3">Game Over</v-card-title>

      <v-card-actions class="mt-6">
        <v-btn color="primary" size="large" @click="router.push('/')">
          Return Home
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()
  const router = useRouter()
</script>
