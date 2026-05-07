<template>
  <v-card v-if="game.amOnTeam && !submitted" class="ma-4 pa-4" elevation="8" style="width: fit-content; justify-self: center;">
    <v-card-title class="d-flex flex-column align-center">
      <span>Select a mission outcome</span>
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
          @click="confirmChoice('Success')"
        >Success</v-btn>

        <v-btn
          v-else
          color="red"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px"
          variant="tonal"
          @click="confirmChoice('Fail')"
        >Fail</v-btn>
      </div>

      <div class="mt-2">
        <v-btn
          v-if="num == 1"
          color="red"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px"
          variant="tonal"
          @click="confirmChoice('Fail')"
        >Fail</v-btn>

        <v-btn
          v-else
          color="blue"
          style="width: 40vw; height: 40vw; max-width: 250px; max-height: 250px;"
          variant="tonal"
          @click="confirmChoice('Success')"
        >Success</v-btn>
      </div>
    </v-card-text>
  </v-card>

  <v-card
    v-else-if="!game.amOnTeam"
    class="ma-4 pa-4"
    elevation="8"
    style="width: fit-content; justify-self: center;"
    text="The team is on their mission. Please be patient."
    title="Mission in Progress"
  />

  <v-card
    v-else
    class="ma-4 pa-4"
    elevation="8"
    style="width: fit-content; justify-self: center;"
    text="Waiting for the rest of the team to play their cards..."
    title="Card Submitted"
  />

  <v-dialog v-model="dialog" max-width="400">
    <v-card>
      <v-card-title class="text-center">Confirm Selection</v-card-title>

      <v-card-text class="text-center">
        Are you sure you want to select
        <strong :class="selectedChoice === 'Success' ? 'text-blue' : 'text-red'">{{ selectedChoice }}</strong>?
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn variant="tonal" @click="dialog = false">Cancel</v-btn>

        <v-btn
          :color="selectedChoice === 'Success' ? 'blue' : 'red'"
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
    game.playMissionCard(selectedChoice.value === 'Success')
    submitted.value = true
  }
</script>
