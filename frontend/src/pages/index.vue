<template>
  <v-layout>
    <AppNav />

    <v-main style="height: 100vh">
      <v-container
        class="d-flex align-center justify-center"
        style="min-height: 100%"
      >
        <v-card
          elevation="4"
          style="height: 550px; width: 100%; max-width: 500px"
        >
          <v-card-item>
            <v-card-title class="text-center"> Room Code </v-card-title>

            <v-text-field
              v-model="roomCode"
              class="mt-5"
              label="Enter Room Code"
              min-width="400px"
              @keyup.enter="joinGame"
            />

            <div class="d-flex justify-center mt-3">
              <v-btn
                :disabled="!roomCode"
                variant="outlined"
                @click="joinGame"
              >Play</v-btn>
            </div>

            <v-divider class="my-5" />

            <div class="d-flex justify-center">
              <v-btn
                :loading="hosting"
                variant="outlined"
                @click="hostGame"
              >Host Game</v-btn>
            </div>

            <div v-if="error" class="text-center text-error mt-3">
              {{ error }}
            </div>
          </v-card-item>
        </v-card>
      </v-container>
    </v-main>
  </v-layout>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import AppNav from '@/components/AppNav.vue'

  const router = useRouter()
  const roomCode = ref('')
  const hosting = ref(false)
  const error = ref('')

  function joinGame () {
    const code = roomCode.value.trim()
    if (!code) return
    router.push(`/Game/${code}/Lobby`)
  }

  async function hostGame () {
    hosting.value = true
    error.value = ''
    try {
      const res = await fetch('/resistance-games', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        error.value = `Failed to create game (${res.status})`
        return
      }
      const { join_code } = await res.json()
      router.push(`/Game/${join_code}/Lobby`)
    } catch (error_) {
      error.value = (error_ as Error).message
    } finally {
      hosting.value = false
    }
  }
</script>
