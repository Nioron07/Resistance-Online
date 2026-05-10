<template>
  <div class="r-phase">
    <v-card v-if="!submitted" class="r-phase-card pa-6">
      <header class="r-phase-header">
        <div class="r-phase-eyebrow">PHASE · SUSPICION</div>
        <h1 class="r-phase-title">WHO DO YOU SUSPECT?</h1>
        <p class="r-phase-sub">Pick up to {{ game.numSpies }} spies — or leave a slot empty.</p>
      </header>

      <div class="r-slot-grid">
        <div v-for="slot in game.numSpies" :key="slot" class="r-slot-card">
          <div class="r-slot-label">SPY #{{ slot }}</div>

          <v-select
            class="mt-2"
            hide-details
            item-title="label"
            item-value="value"
            :items="availableOptions(slot)"
            label="PLAYER"
            :model-value="slotPlayer(slot) ?? null"
            @update:model-value="setSpy(slot, $event)"
          />

          <v-select
            v-if="slotPlayer(slot) !== null && slotPlayer(slot) !== undefined"
            class="mt-2"
            hide-details
            item-title="label"
            item-value="value"
            :items="confidenceValues"
            label="CONFIDENCE"
            :model-value="selections[slotPlayer(slot)!]"
            @update:model-value="selections[slotPlayer(slot)!] = $event"
          />
        </div>
      </div>

      <v-btn
        block
        class="mt-5 r-submit-btn"
        color="primary"
        prepend-icon="mdi-check"
        size="large"
        variant="flat"
        @click="submitSuspicions"
      >
        SUBMIT SUSPICIONS
      </v-btn>
    </v-card>

    <v-card v-else class="r-phase-card pa-6 text-center">
      <h2 class="r-phase-title">SUSPICIONS SUBMITTED</h2>
      <p class="r-phase-sub">Waiting for other players…</p>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()

  const confidenceValues = [
    { label: 'UNSURE', value: 1 },
    { label: 'SOMEWHAT SURE', value: 2 },
    { label: 'CONFIDENT', value: 3 },
    { label: 'VERY CONFIDENT', value: 4 },
  ]

  const slotAssignments = ref<Record<number, number | null>>({})
  const selections = ref<Record<number, number>>({})
  const submitted = ref(false)

  function slotPlayer (slot: number): number | null {
    return slotAssignments.value[slot] ?? null
  }

  function availableOptions (slot: number) {
    const current = slotPlayer(slot)
    const taken = new Set(
      Object.values(slotAssignments.value).filter(
        (id): id is number => id !== null,
      ),
    )
    const options = game.playerIds
      .filter(id => id !== game.myId)
      .filter(id => id === current || !taken.has(id))
      .map(id => ({
        label: game.playerProfiles[id]?.username ?? `Player ${id}`,
        value: id,
      }))
    return [{ label: 'NONE', value: null }, ...options]
  }

  function setSpy (slot: number, playerId: number | null) {
    const old = slotPlayer(slot)
    if (old !== null && old !== undefined) delete selections.value[old]
    slotAssignments.value[slot] = playerId
    if (playerId !== null) selections.value[playerId] = 1
  }

  function submitSuspicions () {
    game.submitSuspicions({ ...selections.value })
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
  max-width: 1100px;
  background-color: rgba(19, 23, 32, 0.85) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgb(var(--v-theme-border)) !important;
  border-radius: 12px;
}
.r-phase-header { text-align: center; margin-bottom: 16px; }
.r-phase-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-phase-title {
  font-size: 1.4rem;
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

.r-slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.r-slot-card {
  background-color: rgb(var(--v-theme-surface-elevated));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 8px;
  padding: 14px;
}
.r-slot-label {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
  text-align: center;
}

.r-submit-btn {
  font-weight: 500;
  letter-spacing: 0.12em;
}
</style>
