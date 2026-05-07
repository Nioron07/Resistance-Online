<template>
  <v-card v-if="!submitted" class="ma-4 pa-4" style="width: fit-content; justify-self: center;">
    <v-card-title class="d-flex flex-column align-center">
      <span>Select your Identity</span>
      <div />
      <span>(Order is randomized, be discrete)</span>
    </v-card-title>

    <v-card-text class="d-flex flex-column align-center">
      <div class="mb-2">
        <v-btn
          v-if="num == 1"
          color="blue"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px"
          variant="tonal"
          @click="confirmChoice('Resistance')"
        >Resistance</v-btn>

        <v-btn
          v-else
          color="red"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px"
          variant="tonal"
          @click="confirmChoice('Spy')"
        >Spy</v-btn>
      </div>

      <div class="mt-2">
        <v-btn
          v-if="num == 1"
          color="red"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px"
          variant="tonal"
          @click="confirmChoice('Spy')"
        >Spy</v-btn>

        <v-btn
          v-else
          color="blue"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px;"
          variant="tonal"
          @click="confirmChoice('Resistance')"
        >Resistance</v-btn>
      </div>
    </v-card-text>
  </v-card>

  <v-card
    v-else
    class="ma-4 pa-4"
    elevation="8"
    style="width: fit-content; justify-self: center;"
    text="Waiting for other players to select their identity..."
    title="Identity Submitted"
  />

  <v-dialog v-model="dialog" max-width="400">
    <v-card>
      <v-card-title class="text-center">Confirm Selection</v-card-title>

      <v-card-text class="text-center">
        Are you sure you want to select
        <strong :class="selectedChoice === 'Resistance' ? 'text-blue' : 'text-red'">{{ selectedChoice }}</strong>?
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn variant="tonal" @click="dialog = false">Cancel</v-btn>

        <v-btn
          :color="selectedChoice === 'Resistance' ? 'blue' : 'red'"
          variant="tonal"
          @click="submitChoice"
        >
          Confirm
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
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
