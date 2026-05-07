<template>
  <v-card
    class="ma-1 flex-grow-1"
    :color="selected ? 'primary' : undefined"
    :hover="selectable"
    :ripple="selectable"
    :style="selectable ? 'cursor: pointer; transition: all 0.2s ease;' : ''"
    :variant="selected ? 'tonal' : 'elevated'"
    @click="selectable ? $emit('select') : undefined"
  >
    <v-icon
      v-if="selected && selectable"
      color="primary"
      icon="mdi-check-circle"
      size="small"
      style="position: absolute; top: 8px; right: 8px;"
    />

    <v-card-title class="text-body text-center text-wrap" :class="smAndDown ? 'text-caption pa-1' : ''">
      {{ username }}
    </v-card-title>

    <div class="d-flex justify-center">
      <v-avatar color="transparent" rounded="0" :size="smAndDown ? 48 : 100">
        <v-img cover rounded="xl" :src="avatar" />
      </v-avatar>
    </div>

    <v-card-text class="d-flex justify-center ga-1 flex-wrap" :class="smAndDown ? 'pa-1' : ''">
      <v-chip
        v-for="(color, number) in record"
        :key="number"
        :color="color"
        label
        :size="smAndDown ? 'x-small' : 'small'"
      >
        {{ number }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { useDisplay } from 'vuetify'

  const { smAndDown } = useDisplay()

  withDefaults(defineProps<{
    username: string
    avatar?: string
    record?: Record<string, string>
    selected?: boolean
    selectable?: boolean
  }>(), {
    avatar: 'https://cdn.vuetifyjs.com/images/profiles/marcus.jpg',
    record: () => ({}),
    selected: false,
    selectable: false,
  })

  defineEmits<{
    select: []
  }>()
// AI created component by extracting repeated card markup from TeamSelection and TeamVote; user specified props and selectable behavior
</script>
