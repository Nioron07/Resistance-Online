<template>
  <v-card class="ma-4" elevation="8" style="width: fit-content; justify-self: center;">
    <v-card-title style="justify-self: center;">Team Vote</v-card-title>

    <v-card-text class="bg-surface-light pt-4">
      The selected team is:
      <div class="d-flex justify-space-evenly">
        <v-row justify="center">
          <v-col v-for="id in game.nominatedTeam" :key="id" cols="12" sm="auto">
            <PlayerCard
              :avatar="game.playerProfiles[id]?.avatar"
              :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
            />
          </v-col>
        </v-row>
      </div>

      <div class="d-flex justify-center mt-3">
        <v-chip color="primary" label>
          <v-icon icon="mdi-vote" start />
          {{ game.votesReceived.length }} / {{ game.playerCount }} voted
        </v-chip>
      </div>
    </v-card-text>

    <div class="d-flex justify-center justify-space-evenly ma-5">
      <v-btn
        color="green"
        :disabled="hasVoted"
        prepend-icon="mdi-check"
        variant="tonal"
        @click="vote(true)"
      >
        Approve
      </v-btn>

      <v-btn
        color="red"
        :disabled="hasVoted"
        prepend-icon="mdi-close"
        variant="tonal"
        @click="vote(false)"
      >
        Reject
      </v-btn>
    </div>

    <div v-if="hasVoted" class="text-center text-medium-emphasis mb-4">
      Vote submitted. Waiting for other players...
    </div>
  </v-card>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()
  const hasVoted = ref(false)

  function vote (approve: boolean) {
    if (hasVoted.value) return
    game.castVote(approve)
    hasVoted.value = true
  }
</script>
