<template>
  <v-app-bar class="r-game-bar" elevation="0" flat>
    <template #prepend>
      <div v-if="!smAndDown" class="d-flex align-center ga-3 ml-2">
        <span class="r-game-code">CODE · <span class="tabular-nums">{{ $route.params.GameID }}</span></span>

        <span class="r-stat tabular-nums">
          <v-icon icon="mdi-account-group" size="small" />
          {{ game.playerCount }}
        </span>

        <span class="r-stat r-stat-resistance tabular-nums">
          <v-icon icon="mdi-shield" size="small" />
          {{ game.numResistance }}
        </span>

        <span class="r-stat r-stat-spy tabular-nums">
          <v-icon icon="mdi-eye" size="small" />
          {{ game.numSpies }}
        </span>
      </div>

      <v-btn
        v-else
        icon="mdi-information-outline"
        size="small"
        variant="text"
        @click="infoDialog = true"
      />
    </template>

    <div class="r-tracker-container">
      <MissionTracker :dense="smAndDown" :outcomes="missionOutcomesAsBool" :player-count="game.playerCount" />
    </div>

    <template #append>
      <span v-if="!smAndDown" class="r-phase">
        {{ game.phaseLabel?.toUpperCase() }}
      </span>
    </template>
  </v-app-bar>

  <v-dialog v-model="infoDialog" max-width="350">
    <v-card class="pa-4">
      <h3 class="r-dialog-title">GAME INFO</h3>

      <div class="r-dialog-grid">
        <div><span class="r-dialog-label">CODE</span><span class="tabular-nums">{{ $route.params.GameID }}</span></div>
        <div><span class="r-dialog-label">PLAYERS</span><span class="tabular-nums">{{ game.playerCount }}</span></div>
        <div><span class="r-dialog-label r-stat-resistance">RESISTANCE</span><span class="tabular-nums">{{ game.numResistance }}</span></div>
        <div><span class="r-dialog-label r-stat-spy">SPIES</span><span class="tabular-nums">{{ game.numSpies }}</span></div>
        <div class="r-dialog-row-wide"><span class="r-dialog-label">PHASE</span><span>{{ game.phaseLabel?.toUpperCase() }}</span></div>
      </div>

      <v-btn block class="mt-4" variant="tonal" @click="infoDialog = false">CLOSE</v-btn>
    </v-card>
  </v-dialog>

  <v-main style="--v-layout-top: 0px;">
    <div class="r-game-stage">
      <v-img class="r-game-bg" cover :src="game.backgroundImage">
        <div class="r-game-overlay" />
      </v-img>

      <div class="r-game-content">
        <router-view />
      </div>
    </div>
  </v-main>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import MissionTracker from '@/components/MissionTracker.vue'
  import { useGameStore } from '@/stores/game'

  const { smAndDown } = useDisplay()
  const infoDialog = ref(false)
  const game = useGameStore()
  const route = useRoute()

  /**
   * Translate the store's `'transparent' | 'blue' | 'red'` outcome strings
   * into MissionTracker's boolean / null format.
   */
  const missionOutcomesAsBool = computed(() => {
    return game.missionOutcomes.map(o => {
      if (o === 'blue') return true
      if (o === 'red') return false
      return null
    })
  })

  /**
   * Read-only post-game views (EndState, Replay) are served from the
   * metrics / replay endpoints — they don't need a live WS, and opening
   * one against an already-finished game just produces console errors.
   * Skip the connect entirely on those routes; the live phases (Lobby /
   * TeamSelection / TeamVote / Suspicion / Mission / etc.) still get a
   * socket.
   */
  const isReadOnlyRoute = computed(() => /\/(EndState|Replay)\/?$/i.test(route.path))

  onMounted(() => {
    if (isReadOnlyRoute.value) return
    const code = String(route.params.GameID ?? '')
    if (code) game.connect(code)
  })

  onUnmounted(() => {
    if (isReadOnlyRoute.value) return
    game.disconnect()
  })
</script>

<style scoped>
.r-game-bar {
  background-color: rgba(10, 14, 20, 0.7) !important;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgb(var(--v-theme-border));
}
.r-game-code {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface));
}
.r-stat-resistance { color: var(--r-resistance); }
.r-stat-spy        { color: var(--r-spy); }
.r-tracker-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.r-phase {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  margin-right: 12px;
  color: var(--r-resistance);
}

.r-dialog-title {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  margin: 0 0 12px;
  color: rgb(var(--v-theme-on-surface-muted));
  text-align: center;
}
.r-dialog-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.r-dialog-grid > div {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}
.r-dialog-row-wide { grid-column: 1 / -1; }
.r-dialog-label {
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-muted));
}

.r-game-stage {
  position: relative;
  height: calc(100vh - 64px);
}
.r-game-bg {
  position: absolute;
  inset: 0;
}
.r-game-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10,14,20,0.65) 0%, rgba(10,14,20,0.85) 100%);
}
.r-game-content {
  position: relative;
  z-index: 2;
  height: 100%;
  overflow-y: auto;
}
</style>
