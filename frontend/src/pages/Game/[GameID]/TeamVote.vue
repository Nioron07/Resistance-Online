<template>
  <div class="r-phase">
    <v-card class="r-phase-card pa-6">
      <header class="r-phase-header">
        <div class="r-phase-eyebrow">PHASE · VOTE</div>
        <h1 class="r-phase-title">PROPOSED TEAM</h1>
      </header>

      <div class="r-team-row">
        <PlayerCard
          v-for="id in game.nominatedTeam"
          :key="id"
          :avatar="game.playerProfiles[id]?.avatar"
          side="resistance"
          :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
        />
      </div>

      <div class="r-vote-progress">
        <div class="r-vote-progress-track">
          <div class="r-vote-progress-bar" :style="{ width: `${progressPct}%` }" />
        </div>

        <div class="r-vote-progress-label tabular-nums">
          {{ game.votesReceived.length }} / {{ game.playerCount }} VOTED
        </div>
      </div>

      <div class="r-vote-actions">
        <v-btn
          class="r-vote-btn"
          color="success"
          :disabled="hasVoted"
          prepend-icon="mdi-check"
          size="large"
          variant="flat"
          @click="vote(true)"
        >
          APPROVE
        </v-btn>

        <v-btn
          class="r-vote-btn"
          color="error"
          :disabled="hasVoted"
          prepend-icon="mdi-close"
          size="large"
          variant="flat"
          @click="vote(false)"
        >
          REJECT
        </v-btn>
      </div>

      <div v-if="hasVoted" class="r-phase-sub text-center mt-3">
        VOTE SUBMITTED — WAITING FOR OTHERS…
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import PlayerCard from '@/components/PlayerCard.vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()
  const hasVoted = ref(false)

  const progressPct = computed(() => {
    if (!game.playerCount) return 0
    return (game.votesReceived.length / game.playerCount) * 100
  })

  function vote (approve: boolean) {
    if (hasVoted.value) return
    game.castVote(approve)
    hasVoted.value = true
  }
</script>

<style scoped>
.r-phase {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  min-height: 100%;
}
.r-phase-card {
  width: 100%;
  max-width: 720px;
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
.r-phase-title {
  font-size: 1.4rem;
  font-weight: 300;
  letter-spacing: 0.06em;
  margin: 4px 0;
}
.r-phase-sub {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.08em;
  margin: 0;
}

.r-team-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
  max-width: 600px;
  margin: 0 auto 20px;
}

.r-vote-progress { margin: 12px 0 16px; }
.r-vote-progress-track {
  width: 100%;
  height: 4px;
  background-color: rgb(var(--v-theme-border));
  border-radius: 2px;
  overflow: hidden;
}
.r-vote-progress-bar {
  height: 100%;
  background-color: var(--r-resistance);
  transition: width 200ms ease-out;
}
.r-vote-progress-label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-on-surface-muted));
  margin-top: 4px;
  text-align: center;
}

.r-vote-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.r-vote-btn {
  font-weight: 500;
  letter-spacing: 0.12em;
}
</style>
