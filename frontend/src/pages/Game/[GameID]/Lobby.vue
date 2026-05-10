<template>
  <div class="r-phase">
    <v-card class="r-phase-card pa-6">
      <header class="r-phase-header">
        <div class="r-phase-eyebrow">LOBBY</div>

        <div class="r-code-line">
          <span class="r-code-label">CODE</span>
          <span class="r-code-value tabular-nums">{{ $route.params.GameID }}</span>
          <v-btn icon="mdi-content-copy" size="x-small" variant="text" @click="copyCode" />
          <span v-if="copied" class="text-medium-emphasis ml-1">copied</span>
        </div>

        <div class="r-count-row">
          <span class="r-count-pill tabular-nums">
            <v-icon icon="mdi-account-group" size="small" />
            {{ game.playerCount }} / 10
          </span>

          <span v-if="game.playerCount < 5" class="r-count-pill r-count-warn tabular-nums">
            NEED {{ 5 - game.playerCount }} MORE
          </span>
        </div>

        <p class="r-phase-sub mt-2">
          {{ game.isHost ? 'You are the host. Player #1 is the starting leader.' : 'Waiting for the host to start…' }}
        </p>
      </header>

      <draggable
        v-if="game.isHost"
        v-model="game.playerIds"
        :animation="200"
        class="r-player-grid"
        item-key="id"
      >
        <template #item="{ element: id, index }">
          <div class="r-player-slot">
            <span class="r-seat-badge tabular-nums" :class="{ 'r-seat-leader': index === 0 }">
              {{ index === 0 ? '★' : index + 1 }}
            </span>

            <PlayerCard
              :avatar="game.playerProfiles[id]?.avatar"
              :selected="index === 0"
              :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
            />
          </div>
        </template>
      </draggable>

      <div v-else class="r-player-grid">
        <div v-for="(id, index) in game.playerIds" :key="id" class="r-player-slot">
          <span class="r-seat-badge tabular-nums" :class="{ 'r-seat-leader': index === 0 }">
            {{ index === 0 ? '★' : index + 1 }}
          </span>

          <PlayerCard
            :avatar="game.playerProfiles[id]?.avatar"
            :selected="index === 0"
            :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
          />
        </div>
      </div>

      <v-btn
        v-if="game.isHost"
        block
        class="mt-5 r-start-btn"
        color="primary"
        :disabled="game.playerCount < 5"
        prepend-icon="mdi-play"
        size="large"
        variant="flat"
        @click="startGame"
      >
        START GAME
      </v-btn>

      <div class="r-tip">
        <v-icon class="mr-1" icon="mdi-lightbulb-outline" size="small" />

        <transition mode="out-in" name="fade">
          <span :key="currentTip">{{ tips[currentTip] }}</span>
        </transition>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { onUnmounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import draggable from 'vuedraggable'
  import PlayerCard from '@/components/PlayerCard.vue'
  import { useGameStore } from '@/stores/game'

  const route = useRoute()
  const game = useGameStore()
  const copied = ref(false)

  const tips = [
    'EVERYONE IS LYING TO YOU. Trust no one — not even yourself.',
    'Your vote matters; you never know if it\'s the deciding one.',
    'As a spy, predictability is a death sentence. Vary your behavior.',
    'During role reveal, sync up with fellow spies — a thumbs-up is plenty.',
    'Some missions need 2 fail cards. Coordinate with your spy partner.',
    'Watch hands during reveal — fidgets give away identities.',
    'Stay engaged in conversation. Silence is a tell.',
    'Resistance: only spies can play fail. You always play success.',
  ]

  const currentTip = ref(Math.floor(Math.random() * tips.length))
  const tipInterval = setInterval(() => {
    currentTip.value = (currentTip.value + 1) % tips.length
  }, 10_000)
  onUnmounted(() => clearInterval(tipInterval))

  async function copyCode () {
    try {
      await navigator.clipboard.writeText(String(route.params.GameID ?? ''))
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 1500)
    } catch { /* ignore */ }
  }

  function startGame () {
    game.startGame()
  }
</script>

<style scoped>
.r-phase {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
  min-height: 100%;
}
.r-phase-card {
  width: 100%;
  max-width: 800px;
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
.r-code-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.r-code-label {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-code-value {
  font-size: 1.6rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: rgb(var(--v-theme-on-surface));
}
.r-count-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
.r-count-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: rgb(var(--v-theme-on-surface));
}
.r-count-warn {
  border-color: rgba(245, 158, 11, 0.5);
  color: var(--r-warning);
}
.r-phase-sub {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.04em;
  margin: 0;
}

.r-player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  max-width: 720px;
  margin: 0 auto;
}
.r-player-slot {
  position: relative;
  cursor: grab;
}
.r-seat-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
  width: 22px;
  height: 22px;
  background-color: rgba(10, 14, 20, 0.85);
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-muted));
}
.r-seat-leader {
  border-color: var(--r-resistance);
  color: var(--r-resistance);
}

.r-start-btn {
  font-weight: 500;
  letter-spacing: 0.12em;
}

.r-tip {
  margin-top: 24px;
  text-align: center;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.02em;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.fade-enter-active,
.fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
