<template>
  <div class="r-phase">
    <v-card v-if="game.amLeader" class="r-phase-card pa-6">
      <header class="r-phase-header">
        <div class="r-phase-eyebrow">PHASE · TEAM SELECT</div>
        <h1 class="r-phase-title">CHOOSE YOUR TEAM</h1>

        <p class="r-phase-sub tabular-nums">
          {{ selectedMembers.length }} / {{ maxTeamSize }} SELECTED
        </p>
      </header>

      <v-item-group v-model="selectedMembers" multiple>
        <div class="r-pick-grid">
          <v-item v-for="id in game.playerIds" :key="id" v-slot="{ isSelected, toggle }" :value="id">
            <PlayerCard
              :avatar="game.playerProfiles[id]?.avatar"
              selectable
              :selected="isSelected ?? false"
              :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
              @select="toggle && toggleMember(id, isSelected ?? false, toggle)"
            />
          </v-item>
        </div>
      </v-item-group>

      <v-btn
        block
        class="mt-5 r-confirm-btn"
        color="primary"
        :disabled="selectedMembers.length !== maxTeamSize"
        prepend-icon="mdi-check"
        size="large"
        variant="flat"
        @click="submitTeam"
      >
        CONFIRM TEAM
      </v-btn>
    </v-card>

    <v-card v-else class="r-phase-card pa-6 text-center">
      <h2 class="r-phase-title">{{ leaderName }} IS PICKING</h2>
      <p class="r-phase-sub">Sit tight while the team is selected.</p>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import PlayerCard from '@/components/PlayerCard.vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()
  const maxTeamSize = computed(() => game.currTeamSize)
  const leaderName = computed(() => (game.leaderName || 'THE LEADER').toUpperCase())
  const selectedMembers = ref<number[]>([])

  function toggleMember (_id: number, isSelected: boolean, toggle: () => void) {
    if (!isSelected && selectedMembers.value.length >= maxTeamSize.value) return
    toggle()
  }

  function submitTeam () {
    game.submitNomination([...selectedMembers.value])
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

.r-pick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
  max-width: 600px;
  margin: 0 auto;
}

.r-confirm-btn {
  font-weight: 500;
  letter-spacing: 0.12em;
}
</style>
