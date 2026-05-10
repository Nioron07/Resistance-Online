<template>
  <div class="r-phase">
    <v-card v-if="!submitted" class="r-phase-card pa-6">
      <header class="r-phase-header">
        <div class="r-phase-eyebrow">PHASE · ROLE</div>
        <h1 class="r-phase-title">SELECT YOUR IDENTITY</h1>
        <p class="r-phase-sub">Order randomized — be discrete.</p>
      </header>

      <div class="r-identity-grid">
        <v-btn
          v-if="num == 1"
          class="r-identity-btn r-identity-resistance"
          color="primary"
          size="x-large"
          variant="flat"
          @click="confirmChoice('Resistance')"
        >RESISTANCE</v-btn>

        <v-btn
          v-else
          class="r-identity-btn r-identity-spy"
          color="error"
          size="x-large"
          variant="flat"
          @click="confirmChoice('Spy')"
        >SPY</v-btn>

        <v-btn
          v-if="num == 1"
          class="r-identity-btn r-identity-spy"
          color="error"
          size="x-large"
          variant="flat"
          @click="confirmChoice('Spy')"
        >SPY</v-btn>

        <v-btn
          v-else
          class="r-identity-btn r-identity-resistance"
          color="primary"
          size="x-large"
          variant="flat"
          @click="confirmChoice('Resistance')"
        >RESISTANCE</v-btn>
      </div>
    </v-card>

    <v-card v-else class="r-phase-card pa-6 text-center">
      <h2 class="r-phase-title">IDENTITY SUBMITTED</h2>
      <p class="r-phase-sub">Waiting for other players…</p>
    </v-card>

    <v-dialog v-model="dialog" max-width="400">
      <v-card class="pa-4">
        <h3 class="r-confirm-title">CONFIRM SELECTION</h3>

        <p class="r-confirm-body">
          Lock in
          <strong :class="selectedChoice === 'Resistance' ? 'text-primary' : 'text-error'">{{ selectedChoice.toUpperCase() }}</strong>?
        </p>

        <div class="d-flex justify-end ga-2 mt-4">
          <v-btn variant="text" @click="dialog = false">CANCEL</v-btn>

          <v-btn
            :color="selectedChoice === 'Resistance' ? 'primary' : 'error'"
            variant="flat"
            @click="submitChoice"
          >
            CONFIRM
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()
  const num: number = Math.round(Math.random())
  const dialog = ref(false)
  const selectedChoice = ref('')
  const submitted = ref(false)

  function confirmChoice (choice: string) {
    selectedChoice.value = choice
    dialog.value = true
  }

  function submitChoice () {
    dialog.value = false
    game.submitRole(selectedChoice.value === 'Resistance' ? 'resistance' : 'spy')
    submitted.value = true
  }
</script>

<style scoped>
.r-phase {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  min-height: 100%;
}
.r-phase-card {
  width: 100%;
  max-width: 720px;
  background-color: rgba(19, 23, 32, 0.85) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgb(var(--v-theme-border)) !important;
  border-radius: 12px;
}
.r-phase-header { text-align: center; margin-bottom: 24px; }
.r-phase-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-phase-title {
  font-size: 1.6rem;
  font-weight: 300;
  letter-spacing: 0.06em;
  margin: 4px 0;
}
.r-phase-sub {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.04em;
  margin: 0;
}

.r-identity-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 540px) { .r-identity-grid { grid-template-columns: 1fr; } }
.r-identity-btn {
  width: 100%;
  height: clamp(140px, 32vw, 220px);
  font-size: clamp(1rem, 3vw, 1.4rem);
  letter-spacing: 0.12em;
  font-weight: 500;
}
.r-identity-resistance { box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5) inset; }
.r-identity-spy        { box-shadow: 0 0 0 1px rgba(239,  68,  68, 0.5) inset; }

.r-confirm-title {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  margin: 0 0 12px;
  color: rgb(var(--v-theme-on-surface-muted));
  text-align: center;
}
.r-confirm-body {
  text-align: center;
  font-size: 0.95rem;
  margin: 0;
}
</style>
