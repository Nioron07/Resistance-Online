<template>
  <div v-if="game.amLeader">
    <div class="d-flex justify-center my-3">
      <v-chip color="primary" label size="large">
        <v-icon icon="mdi-account-check" start />
        {{ selectedMembers.length }} / {{ maxTeamSize }} Selected
      </v-chip>
    </div>

    <v-item-group v-model="selectedMembers" multiple>
      <v-row justify="center" style="max-width: 700px; margin: 0 auto;">
        <v-col
          v-for="id in game.playerIds"
          :key="id"
          class="d-flex justify-center"
          cols="4"
          style="max-width: 200px;"
        >
          <v-item v-slot="{ isSelected, toggle }" :value="id">
            <PlayerCard
              :avatar="game.playerProfiles[id]?.avatar"
              selectable
              :selected="isSelected ?? false"
              :username="game.playerProfiles[id]?.username ?? `Player ${id}`"
              @select="toggle && toggleMember(id, isSelected ?? false, toggle)"
            />
          </v-item>
        </v-col>
      </v-row>
    </v-item-group>

    <div class="d-flex justify-center my-4">
      <v-btn
        color="primary"
        :disabled="selectedMembers.length !== maxTeamSize"
        prepend-icon="mdi-check"
        @click="submitTeam"
      >
        Confirm Team
      </v-btn>
    </div>
  </div>

  <v-card
    v-else
    elevation="8"
    style="width: fit-content; justify-self: center;"
    :text="`${game.leaderName || 'The leader'} is currently making team selections`"
    title="Please be patient"
  />
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useGameStore } from '@/stores/game'

  const game = useGameStore()
  const maxTeamSize = computed(() => game.currTeamSize)
  const selectedMembers = ref<number[]>([])

  function toggleMember (id: number, isSelected: boolean, toggle: () => void) {
    if (!isSelected && selectedMembers.value.length >= maxTeamSize.value) return
    toggle()
  }

  function submitTeam () {
    game.submitNomination([...selectedMembers.value])
  }
</script>
