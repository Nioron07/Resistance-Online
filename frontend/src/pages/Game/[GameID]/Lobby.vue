<template>
  <v-card class="ma-4 pa-4" elevation="8" style="width: fit-content; justify-self: center;">
    <!-- Join Code -->
    <v-card-title class="text-center">
      <div class="d-flex align-center justify-center ga-2">
        <span>Join Code: {{ $route.params.GameID }}</span>
        <v-btn icon="mdi-content-copy" size="x-small" variant="text" @click="copyCode" />
      </div>
    </v-card-title>

    <!-- Player Count -->
    <div class="d-flex justify-center my-2 ga-2">
      <v-chip color="primary" label size="large">
        <v-icon icon="mdi-account-group" start />
        {{ game.playerCount }} / 10 Players
      </v-chip>

      <v-chip v-if="game.playerCount < 5" color="warning" label size="large">
        Need {{ 5 - game.playerCount }} more
      </v-chip>
    </div>

    <v-card-subtitle class="text-center mb-2">
      {{ game.isHost ? 'Player #1 is the starting leader.' : 'Waiting for host to start...' }}
    </v-card-subtitle>

    <!-- Player List -->
    <v-card-text>
      <draggable
        v-if="game.isHost"
        v-model="game.playerIds"
        :animation="200"
        class="d-flex flex-wrap justify-center"
        item-key="id"
        style="max-width: 700px; margin: 0 auto;"
      >
        <template #item="{ element: id, index }">
          <div class="pa-1" style="cursor: grab;">
            <v-badge
              :color="index === 0 ? 'primary' : 'grey'"
              :content="index === 0 ? '★' : index + 1"
              location="top start"
            >
              <PlayerCard
                :avatar="game.playerProfiles[id]?.avatar"
                :selected="index === 0"
                :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
              />
            </v-badge>
          </div>
        </template>
      </draggable>

      <div v-else class="d-flex flex-wrap justify-center" style="max-width: 700px; margin: 0 auto;">
        <div v-for="(id, index) in game.playerIds" :key="id" class="pa-1">
          <v-badge
            :color="index === 0 ? 'primary' : 'grey'"
            :content="index === 0 ? '★' : index + 1"
            location="top start"
          >
            <PlayerCard
              :avatar="game.playerProfiles[id]?.avatar"
              :selected="index === 0"
              :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
            />
          </v-badge>
        </div>
      </div>
    </v-card-text>

    <!-- Start Game (host only) -->
    <div v-if="game.isHost" class="d-flex justify-center mt-2">
      <v-btn
        color="primary"
        :disabled="game.playerCount < 5"
        prepend-icon="mdi-play"
        @click="startGame"
      >
        Start Game
      </v-btn>
    </div>

    <!-- Loading Screen Tips -->
    <div class="text-center mt-4 text-medium-emphasis" style="max-width: 600px; margin: 0 auto; white-space: normal; word-wrap: break-word;">
      <v-icon class="mr-1" icon="mdi-lightbulb-outline" size="small" />

      <transition mode="out-in" name="fade">
        <span :key="currentTip">{{ tips[currentTip] }}</span>
      </transition>
    </div>
  </v-card>
</template>

<script setup lang="ts">
  import { onUnmounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import draggable from 'vuedraggable'
  import { useGameStore } from '@/stores/game'

  const route = useRoute()
  const game = useGameStore()

  const tips = [
    'EVERYONE IS LYING TO YOU, do not trust anyone for any reason, not even yourself.',
    'Find people you can trust, either by watching their behavior, or by having them show you their character card if the oppourtunity arises.',
    'Your vote matters! You never know if your vote could be the deciding one until it\'s flipped, so value it.',
    'As a spy, don\'t tell people you\'re a spy, unless you prefer it that way.',
    'Looking for a great dinner at an even better price? Jurassic grill at 404 E Green St #5866, Champaign, IL 61820 has you covered!',
    'And if you can\'t go to the brick-and-mortar location, stop by at one of the food trucks across campus!',
    'James, sometimes I\'m not a spy, you got to believe me dude, it happens I promise.',
    'When distributing plot cards, it may be beneficial to give multiple to someone untrustworthy to force them to reveal their card. But beware, it could allow them to steal leadership or null a vote if they have nefarious intentions...',
    'Some missions require 2 Fail cards to fail. Communication amongst spies is key for these difficult missions. Remember that Jason.',
    'During the reveal phase, it is imperative all spies know who eachother are. A simple raise of the hand, thumbs up, or gentle caress of the cheek can help ensure everyone remembers who\'s who.',
    'Are you sure the Resistance are on the right side of history? Will your fight be looked at by future generations fondly? Have you considered there\'s a reason things are the way they are?',
    'Even though eyes are closed, certain parts of the body twitch audibly when spies look around for each other. Keep an ear out.',
    'Staying active in conversations is helpful for both spies and Resistance members, but can also bring added suspicion depending on what is said.',
    'As a spy, being predictable is a death sentence, even to yourself. Never think about your next move.',
    'https://youtu.be/DUENzjE9Jwg',
    'Remember! Only spies can choose to put in a fail. Resistance players must put in a success.',
    'Also try Avalon!',
    'As commander, try to gain the trust of a fellow Resistance member and have them take the fall. After all, good generals throw their subbordinates under the bus.',
    'Don\'t do it, don\'t put in that fail card. Ah! Nope, I see you about to put a fail in. Don\'t do it. I\'m serious now, put it back. Put that success in. Good job. Proud of you.',
  ]

  const currentTip = ref(Math.round(Math.random() * tips.length))
  const tipInterval = setInterval(() => {
    currentTip.value = (currentTip.value + 1) % tips.length
  }, 10_000)
  onUnmounted(() => clearInterval(tipInterval))

  function copyCode () {
    navigator.clipboard.writeText(String(route.params.GameID ?? ''))
  }

  function startGame () {
    game.startGame()
  }
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
