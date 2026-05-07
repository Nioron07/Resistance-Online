<template>
  <v-card
    v-if="!submitted"
    class="ma-4 pa-4 mx-auto"
    elevation="8"
    style="width: 100%; max-width: 1100px"
  >
    <v-card-title class="text-center">Select who you suspect is a spy</v-card-title>

    <v-card-text>
      <v-row justify="center">
        <v-col
          v-for="slot in game.numSpies"
          :key="slot"
          cols="12"
          md="3"
          sm="6"
        >
          <v-card class="pa-3" variant="outlined">
            <v-card-subtitle class="text-center font-weight-bold">Spy #{{ slot }}</v-card-subtitle>

            <v-select
              class="mt-2"
              density="comfortable"
              item-title="label"
              item-value="value"
              :items="availableOptions(slot)"
              label="Player"
              :model-value="slotPlayer(slot) ?? null"
              variant="outlined"
              @update:model-value="setSpy(slot, $event)"
            />

            <v-select
              v-if="slotPlayer(slot) !== null && slotPlayer(slot) !== undefined"
              density="comfortable"
              item-title="label"
              item-value="value"
              :items="confidenceValues"
              label="Confidence"
              :model-value="selections[slotPlayer(slot)!]"
              variant="outlined"
              @update:model-value="selections[slotPlayer(slot)!] = $event"
            />
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <div class="d-flex justify-center mt-2">
      <v-btn
        color="primary"
        prepend-icon="mdi-check"
        @click="submitSuspicions"
      >Submit</v-btn>
    </div>
  </v-card>

  <v-card
    v-else
    class="ma-4 pa-4 mx-auto"
    elevation="8"
    style="width: 100%; max-width: 1300px"
    text="Waiting for other players to submit their suspicions..."
    title="Suspicions Submitted"
  />
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()

  const confidenceValues = [
    { label: 'Unsure', value: 1 },
    { label: 'Somewhat Sure', value: 2 },
    { label: 'Confident', value: 3 },
    { label: 'Very Confident', value: 4 },
  ]

  // slot index (1..numSpies) -> playerId
  const slotAssignments = ref<Record<number, number | null>>({})
  // playerId -> confidence value (1..4)
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
    return [{ label: 'None', value: null }, ...options]
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
