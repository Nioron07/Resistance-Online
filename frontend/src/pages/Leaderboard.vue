<template>
  <v-layout>
    <AppNav />

    <v-main style="height: 100vh; overflow-y: auto">
      <v-container class="py-6">

        <v-row class="mb-4" justify="center">
          <v-col class="text-center" cols="12">
            <div class="leaderboard-title">Global Leaderboard</div>
          </v-col>
        </v-row>

        <v-row justify="center">
          <v-col cols="12" md="8">
            <div
              class="leaderboard-section-label text-center mb-3"
              :class="labelClass"
            >{{ activeMode === 'elo' ? 'Elo' : activeMode === 'spy' ? 'Spy' : 'Resistance' }}</div>

            <v-card class="stat-section" :class="cardClass" elevation="4">
              <v-card-text class="d-flex flex-column pa-0">

                <!-- Header row with toggle buttons -->
                <div class="stat-section-header d-flex align-center justify-space-between">
                  <span>TOP PLAYERS</span>

                  <div class="d-flex gap-1">
                    <v-btn
                      :color="activeMode === 'elo' ? 'white' : undefined"
                      density="compact"
                      size="small"
                      :variant="activeMode === 'elo' ? 'flat' : 'text'"
                      @click="activeMode = 'elo'"
                    >Elo</v-btn>

                    <v-btn
                      :color="activeMode === 'spy' ? 'red-lighten-2' : undefined"
                      density="compact"
                      size="small"
                      :variant="activeMode === 'spy' ? 'flat' : 'text'"
                      @click="activeMode = 'spy'"
                    >Spy</v-btn>

                    <v-btn
                      :color="activeMode === 'resistance' ? 'blue-lighten-2' : undefined"
                      density="compact"
                      size="small"
                      :variant="activeMode === 'resistance' ? 'flat' : 'text'"
                      @click="activeMode = 'resistance'"
                    >Resistance</v-btn>
                  </div>
                </div>

                <!-- Player list -->
                <div class="player-list">
                  <template v-for="(player, i) in activePlayers" :key="player.name">
                    <v-tooltip
                      v-if="activeMode === 'elo'"
                      location="end"
                    >
                      <template #activator="{ props }">
                        <div class="player-row" v-bind="props">
                          <span class="player-rank">{{ i + 1 }}</span>
                          <span class="player-name">{{ player.name }}</span>
                          <span class="player-score">{{ player.score }}</span>
                        </div>
                      </template>

                      <div>
                        <div>Spy: {{ (player as EloPlayer).spyScore }}</div>
                        <div>Resistance: {{ (player as EloPlayer).resistanceScore }}</div>
                      </div>
                    </v-tooltip>

                    <div v-else class="player-row">
                      <span class="player-rank">{{ i + 1 }}</span>
                      <span class="player-name">{{ player.name }}</span>
                      <span class="player-score">{{ player.score }}</span>
                    </div>
                  </template>
                </div>

                <v-divider class="my-divider" />

                <div class="you-row">
                  <span class="player-rank you-rank">{{ yourRank }}</span>
                  <span class="player-name you-label">You</span>
                  <span class="player-score">{{ yourScore }}</span>
                </div>

              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

      </v-container>
    </v-main>
  </v-layout>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import AppNav from '@/components/AppNav.vue'

  interface Player {
    name: string
    score: number
  }

  interface EloPlayer extends Player {
    spyScore: number
    resistanceScore: number
  }

  const activeMode = ref<'elo' | 'spy' | 'resistance'>('elo')

  const eloPlayers: EloPlayer[] = [
    { name: 'ShadowBlade', score: 100, spyScore: 85, resistanceScore: 72 },
    { name: 'NightOwl', score: 100, spyScore: 70, resistanceScore: 90 },
    { name: 'IronFox', score: 100, spyScore: 60, resistanceScore: 95 },
    { name: 'CrimsonTide', score: 100, spyScore: 88, resistanceScore: 65 },
    { name: 'GhostWolf', score: 100, spyScore: 92, resistanceScore: 58 },
    { name: 'StormRider', score: 100, spyScore: 55, resistanceScore: 88 },
    { name: 'FrostByte', score: 100, spyScore: 78, resistanceScore: 75 },
    { name: 'VoidWalker', score: 100, spyScore: 82, resistanceScore: 70 },
    { name: 'ArcLight', score: 100, spyScore: 65, resistanceScore: 82 },
    { name: 'DuskHunter', score: 100, spyScore: 74, resistanceScore: 79 },
  ]

  const resistancePlayers: Player[] = [
    { name: 'IronFox', score: 100 },
    { name: 'ArcLight', score: 100 },
    { name: 'StormRider', score: 100 },
    { name: 'FrostByte', score: 100 },
    { name: 'NightOwl', score: 100 },
    { name: 'DuskHunter', score: 100 },
    { name: 'VoidWalker', score: 100 },
    { name: 'ShadowBlade', score: 100 },
    { name: 'CrimsonTide', score: 100 },
    { name: 'GhostWolf', score: 100 },
  ]

  const spyPlayers: Player[] = [
    { name: 'GhostWolf', score: 100 },
    { name: 'CrimsonTide', score: 100 },
    { name: 'VoidWalker', score: 100 },
    { name: 'ShadowBlade', score: 100 },
    { name: 'DuskHunter', score: 100 },
    { name: 'FrostByte', score: 100 },
    { name: 'ArcLight', score: 100 },
    { name: 'IronFox', score: 100 },
    { name: 'NightOwl', score: 100 },
    { name: 'StormRider', score: 100 },
  ]

  const yourEloRank = 50
  const yourResistanceRank = 50
  const yourSpyRank = 50

  const activePlayers = computed(() => {
    if (activeMode.value === 'elo') return eloPlayers
    if (activeMode.value === 'spy') return spyPlayers
    return resistancePlayers
  })

  const yourRank = computed(() => {
    if (activeMode.value === 'elo') return yourEloRank
    if (activeMode.value === 'spy') return yourSpyRank
    return yourResistanceRank
  })

  const yourScore = computed(() => {
    if (activeMode.value === 'elo') return 32
    if (activeMode.value === 'spy') return 32
    return 12
  })

  const cardClass = computed(() => {
    if (activeMode.value === 'spy') return 'stat-section--red'
    if (activeMode.value === 'resistance') return 'stat-section--blue'
    return ''
  })

  const labelClass = computed(() => {
    if (activeMode.value === 'spy') return 'leaderboard-label--red'
    if (activeMode.value === 'resistance') return 'leaderboard-label--blue'
    return 'leaderboard-label--white'
  })
</script>

<style scoped>
.leaderboard-title {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.92);
}

.leaderboard-section-label {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.leaderboard-label--white {
  color: rgba(255, 255, 255, 0.92);
}

.leaderboard-label--blue {
  color: #90caf9;
}

.leaderboard-label--red {
  color: #ef9a9a;
}

.stat-section {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  overflow: hidden;
}

.stat-section-header {
  padding: 8px 14px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-section--blue .stat-section-header {
  color: #90caf9;
  background: rgba(33, 150, 243, 0.12);
  border-bottom-color: rgba(33, 150, 243, 0.2);
}

.stat-section--blue {
  border-color: rgba(33, 150, 243, 0.25);
}

.stat-section--red .stat-section-header {
  color: #ef9a9a;
  background: rgba(244, 67, 54, 0.12);
  border-bottom-color: rgba(244, 67, 54, 0.2);
}

.stat-section--red {
  border-color: rgba(244, 67, 54, 0.25);
}

.player-list {
  flex: 1;
  padding: 6px 0;
}

.player-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 10px;
  transition: background 0.15s;
  cursor: default;
}

.player-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.player-rank {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  width: 22px;
  text-align: right;
  flex-shrink: 0;
}

.player-name {
  flex: 1;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
}

.player-score {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}

.my-divider {
  border-color: rgba(255, 255, 255, 0.1) !important;
  margin: 4px 0;
}

.you-row {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.you-rank {
  color: rgba(255, 255, 255, 0.55);
}

.you-label {
  font-style: italic;
  color: rgba(255, 255, 255, 0.55);
}

.gap-1 {
  gap: 4px;
}
</style>
