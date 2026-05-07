<template>
  <v-app-bar elevation="0">
    <!-- Left: Game info (desktop only) -->
    <template #prepend>
      <div v-if="!smAndDown" class="d-flex align-center ga-3 ml-2">
        <v-app-bar-title class="mr-4">Game Code: {{ $route.params.GameID }}</v-app-bar-title>

        <v-chip label size="small">
          <v-icon icon="mdi-account-group" start />
          {{ game.playerCount }} Players
        </v-chip>

        <v-chip color="blue" label size="small">
          <v-icon icon="mdi-shield" start />
          {{ game.numResistance }} Resistance
        </v-chip>

        <v-chip color="red" label size="small">
          <v-icon icon="mdi-eye" start />
          {{ game.numSpies }} Spies
        </v-chip>
      </div>

      <v-btn
        v-else
        icon="mdi-information-outline"
        size="small"
        variant="text"
        @click="infoDialog = true"
      />
    </template>

    <!-- Center: Mission tracker -->
    <div class="d-flex justify-center align-center w-100" :class="smAndDown ? 'ga-1' : 'ga-2'" :style="smAndDown ? '' : 'position: absolute; left: 50%; transform: translateX(-50%);'">
      <v-avatar v-for="(size, mission) in game.teamSizes" :key="mission" :color="game.missionOutcomes[Number(mission) - 1]" :size="smAndDown ? 28 : 36">
        <span class="text-white" :class="smAndDown ? 'text-caption' : 'text-body-2'">{{ size }}</span>
      </v-avatar>
    </div>

    <!-- Right: Current phase (desktop only) -->
    <template #append>
      <v-chip v-if="!smAndDown" class="mr-2" color="primary" label>
        <v-icon icon="mdi-vote" start />
        {{ game.phaseLabel }}
      </v-chip>

      <v-btn
        v-else
        icon
        size="small"
        style="visibility: hidden;"
        variant="text"
      />
    </template>
  </v-app-bar>

  <!-- Mobile info dialog -->
  <v-dialog v-model="infoDialog" max-width="350">
    <v-card>
      <v-card-title class="text-center">Game Info</v-card-title>

      <v-card-text class="d-flex flex-column align-center ga-3">
        <v-chip label>
          <v-icon icon="mdi-pound" start />
          Game Code: {{ $route.params.GameID }}
        </v-chip>

        <v-chip label>
          <v-icon icon="mdi-account-group" start />
          {{ game.playerCount }} Players
        </v-chip>

        <v-chip color="blue" label>
          <v-icon icon="mdi-shield" start />
          {{ game.numResistance }} Resistance
        </v-chip>

        <v-chip color="red" label>
          <v-icon icon="mdi-eye" start />
          {{ game.numSpies }} Spies
        </v-chip>

        <v-chip color="primary" label>
          <v-icon icon="mdi-vote" start />
          Phase: {{ game.phaseLabel }}
        </v-chip>
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn variant="tonal" @click="infoDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-main style="--v-layout-top: 0px;">
    <v-img cover :src="game.backgroundImage" style="height: calc(100vh - 64px);">
      <router-view />
    </v-img>
  </v-main>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useGameStore } from '@/stores/game'

  const { smAndDown } = useDisplay()
  const infoDialog = ref(false)
  const game = useGameStore()
  const route = useRoute()

  onMounted(() => {
    const code = String(route.params.GameID ?? '')
    if (code) game.connect(code)
  })

  onUnmounted(() => {
    game.disconnect()
  })
</script>
