<template>
  <v-container class="r-home" max-width="900">
    <header class="r-hero">
      <h1 class="r-hero-title">ResistanceOnline</h1>
    </header>

    <div class="r-grid">
      <v-card class="r-action-card r-card-hover" :class="{ 'side-resistance': true }" tag="section">
        <div class="r-action-label">JOIN</div>
        <h2 class="r-action-title">Have a code?</h2>

        <v-text-field
          v-model="roomCodeRaw"
          class="r-code-input"
          density="comfortable"
          hide-details
          label="6-DIGIT ROOM CODE"
          maxlength="6"
          placeholder="000000"
          :rules="[v => /^\d{0,6}$/.test(v ?? '') || 'Numbers only']"
          @keyup.enter="joinGame"
        />

        <v-btn
          block
          class="mt-4 r-action-btn"
          color="primary"
          :disabled="!isValidCode"
          variant="flat"
          @click="joinGame"
        >
          ENTER LOBBY
        </v-btn>
      </v-card>

      <v-card class="r-action-card r-card-hover" :class="{ 'side-spy': true }" tag="section">
        <div class="r-action-label">HOST</div>
        <h2 class="r-action-title">New game?</h2>
        <p class="r-action-blurb">Create a room and share the code with your friends.</p>

        <v-btn
          block
          class="mt-4 r-action-btn"
          color="error"
          :loading="hosting"
          variant="flat"
          @click="hostGame"
        >
          CREATE ROOM
        </v-btn>
      </v-card>
    </div>

    <div v-if="error" class="r-error">{{ error }}</div>

    <div v-if="lastGame" class="r-last-game">
      <span class="text-caption">LAST GAME · {{ formatDate(lastGame.endTimestamp) }}</span>

      <v-btn
        class="ml-2"
        size="small"
        variant="text"
        @click="router.push(`/Game/${lastGame.gameid}/EndState`)"
      >
        REVIEW GAME #{{ lastGame.gameid }}
        <v-icon end icon="mdi-chevron-right" />
      </v-btn>
    </div>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { fetchUserGames, type UserGameLogEntry } from '@/services/api'
  import { useAppStore } from '@/stores/app'

  const router = useRouter()
  const appStore = useAppStore()

  const roomCodeRaw = ref('')
  const hosting = ref(false)
  const error = ref('')
  const lastGame = ref<UserGameLogEntry | null>(null)

  const isValidCode = computed(() => /^\d{6}$/.test(roomCodeRaw.value))

  function joinGame () {
    if (!isValidCode.value) return
    router.push(`/Game/${roomCodeRaw.value}/Lobby`)
  }

  async function hostGame () {
    hosting.value = true
    error.value = ''
    try {
      const res = await fetch('/resistance-games', { method: 'POST', credentials: 'include' })
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

  function formatDate (s: string): string {
    try {
      return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return s
    }
  }

  onMounted(async () => {
    await appStore.fetchUser()
    if (appStore.user?.id != null) {
      try {
        const log = await fetchUserGames(appStore.user.id, 1, 0)
        if (log.rows.length > 0) lastGame.value = log.rows[0]!
      } catch {
        // non-fatal — just hide the panel
      }
    }
  })
</script>

<style scoped>
.r-home { padding-top: 48px; padding-bottom: 48px; }
.r-hero { text-align: center; margin-bottom: 32px; }
.r-hero-title {
  font-size: clamp(2.5rem, 7vw, 4.5rem);
  font-weight: 300;
  letter-spacing: 0.04em;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.r-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 600px) {
  .r-grid { grid-template-columns: 1fr; }
}
.r-action-card {
  background-color: rgb(var(--v-theme-surface)) !important;
  padding: 24px;
  border: 1px solid rgb(var(--v-theme-border)) !important;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}
.r-action-label {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-action-title {
  font-size: 1.5rem;
  font-weight: 300;
  margin: 4px 0 16px;
  letter-spacing: 0.02em;
}
.r-action-blurb {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface-muted));
  margin: 0;
}
.r-code-input :deep(input) {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.4em;
  text-align: center;
  font-size: 1.5rem;
}
.r-action-btn {
  font-weight: 500;
  letter-spacing: 0.1em;
}

.r-error {
  margin-top: 16px;
  text-align: center;
  color: var(--r-spy);
  font-size: 0.875rem;
}
.r-last-game {
  margin-top: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  color: rgb(var(--v-theme-on-surface-muted));
}
</style>
