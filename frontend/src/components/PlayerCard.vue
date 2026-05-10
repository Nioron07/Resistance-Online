<template>
  <v-card
    class="player-card r-card-hover"
    :class="cardClass"
    :hover="selectable"
    :ripple="selectable"
    :variant="selected ? 'tonal' : 'elevated'"
    @click="selectable ? $emit('select') : undefined"
  >
    <div v-if="selected && selectable" class="check-icon">
      <v-icon icon="mdi-check-circle" size="small" />
    </div>

    <div class="player-name" :class="smAndDown ? 'text-caption' : 'text-body-2'">
      {{ username }}
    </div>

    <div class="d-flex justify-center">
      <v-avatar color="transparent" rounded="lg" :size="smAndDown ? 48 : 88">
        <v-img cover :src="avatar" />
      </v-avatar>
    </div>

    <div v-if="hasRecord" class="record-row" :class="smAndDown ? 'pa-1' : ''">
      <v-chip
        v-for="(color, number) in record"
        :key="number"
        :color="color"
        density="compact"
        label
        :size="smAndDown ? 'x-small' : 'small'"
        variant="tonal"
      >
        {{ number }}
      </v-chip>
    </div>
  </v-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useDisplay } from 'vuetify'

  const props = withDefaults(defineProps<{
    username: string
    avatar?: string
    record?: Record<string, string>
    selected?: boolean
    selectable?: boolean
    /** Optional side accent border (top edge color). */
    side?: 'resistance' | 'spy' | null
  }>(), {
    avatar: 'https://cdn.vuetifyjs.com/images/profiles/marcus.jpg',
    record: () => ({}),
    selected: false,
    selectable: false,
    side: null,
  })

  defineEmits<{ select: [] }>()

  const { smAndDown } = useDisplay()

  const hasRecord = computed(() => Object.keys(props.record).length > 0)

  const cardClass = computed(() => ({
    'player-card-selectable': props.selectable,
    'player-card-selected': props.selected && props.selectable,
    'side-resistance': props.side === 'resistance',
    'side-spy': props.side === 'spy',
  }))
</script>

<style scoped>
.player-card {
  position: relative;
  background-color: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 12px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
}
.player-card-selectable { cursor: pointer; }
.player-card-selected {
  outline: 2px solid var(--r-resistance);
  outline-offset: -1px;
}
.check-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  color: var(--r-resistance);
}
.player-name {
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.02em;
  word-break: break-word;
}
.record-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}
</style>
