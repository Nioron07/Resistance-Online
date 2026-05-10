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
          {{
            game.isHost
              ? "You are the host. Drag a player onto another to swap their seats."
              : "Waiting for the host to start…"
          }}
        </p>
      </header>

      <!-- Circle of players -->
      <div ref="circleEl" class="r-circle">
        <div class="r-circle-center">
          <v-icon class="r-rotate-icon" icon="mdi-rotate-right" size="large" />
          <div class="r-rotate-label">LEADER PASSES<br>CLOCKWISE</div>
        </div>

        <div
          v-for="(id, index) in game.playerIds"
          :key="id"
          class="r-circle-slot"
          :class="{
            'r-circle-slot-host': game.isHost,
            'r-circle-slot-dragging': draggingId === id,
            'r-circle-slot-drop-hover': dragHoverId === id && draggingId !== null && draggingId !== id,
          }"
          :draggable="game.isHost"
          :style="slotStyle(index, game.playerIds.length)"
          @dragend="onDragEnd"
          @dragleave="dragHoverId === id ? (dragHoverId = null) : null"
          @dragover.prevent="dragHoverId = id"
          @dragstart="onDragStart(id, $event)"
          @drop.prevent="onDrop(id)"
        >
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
  import PlayerCard from '@/components/PlayerCard.vue'
  import { useGameStore } from '@/stores/game'

  const route = useRoute()
  const game = useGameStore()
  const copied = ref(false)

  /** Drag-and-drop swap state. */
  const draggingId = ref<number | null>(null)
  const dragHoverId = ref<number | null>(null)

  /**
   * Position each player on a circle. Index 0 sits at 12 o'clock and the
   * sequence proceeds clockwise — matching the in-game leader rotation.
   * Returns CSS positioning relative to the circle container.
   */
  function slotStyle (index: number, total: number): Record<string, string> {
    if (total === 0) return {}
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / total
    const radiusPct = 38 // % of half the container — leaves room for the slot itself
    const x = 50 + radiusPct * Math.cos(angle)
    const y = 50 + radiusPct * Math.sin(angle)
    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
    }
  }

  /** Swap two players in the seat order and broadcast the new order. */
  function swap (a: number, b: number) {
    if (a === b) return
    const order = [...game.playerIds]
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai === -1 || bi === -1) return
    ;[order[ai], order[bi]] = [order[bi]!, order[ai]!]
    game.reorderSeats(order)
  }

  function onDragStart (id: number, ev: DragEvent) {
    if (!game.isHost) return
    draggingId.value = id
    ev.dataTransfer?.setData('text/plain', String(id))
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
  }

  function onDrop (targetId: number) {
    if (!game.isHost) return
    if (draggingId.value === null) return
    swap(draggingId.value, targetId)
    draggingId.value = null
    dragHoverId.value = null
  }

  function onDragEnd () {
    draggingId.value = null
    dragHoverId.value = null
  }

  const tips = [
    'EVERYONE IS LYING TO YOU. Trust no one — not even yourself.',
    'Your vote matters; you never know if it\'s the deciding one.',
    'As a spy, predictability is a death sentence. Vary your behavior.',
    'During role reveal, sync up with fellow spies — a thumbs-up is plenty.',
    'Some missions need 2 fail cards. Coordinate with your spy partner.',
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
.r-phase-header {
  text-align: center;
  margin-bottom: 16px;
}
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

/* ---------------- Circle ---------------- */
.r-circle {
  position: relative;
  width: 100%;
  max-width: 560px;
  margin: 16px auto;
  /* Square aspect via padding-bottom hack so positioning %ages line up. */
  padding-bottom: 100%;
  height: 0;
}
.r-circle-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  text-align: center;
}
.r-rotate-icon {
  color: var(--r-resistance);
  opacity: 0.55;
}
.r-rotate-label {
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  color: rgb(var(--v-theme-on-surface-muted));
  line-height: 1.4;
}

.r-circle-slot {
  position: absolute;
  width: clamp(78px, 22%, 130px);
  user-select: none;
  transition: transform 200ms ease-out, filter 200ms ease-out;
}
.r-circle-slot-host { cursor: grab; }
.r-circle-slot-host:active { cursor: grabbing; }
.r-circle-slot-dragging {
  opacity: 0.55;
}
.r-circle-slot-drop-hover {
  filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.55));
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

/* ---------------- Mobile breakpoint ---------------- */
@media (max-width: 540px) {
  .r-circle {
    max-width: 360px;
  }
  .r-circle-slot {
    width: clamp(70px, 24%, 100px);
  }
  .r-rotate-label {
    font-size: 0.55rem;
    letter-spacing: 0.12em;
  }
}
</style>
