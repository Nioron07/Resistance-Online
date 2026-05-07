<template>
  <v-card class="mx-auto my-8" elevation="4" max-width="500">
    <v-card-item>
      <v-card-title class="text-center">
        Create Your Username
      </v-card-title>

      <v-text-field class="mt-5" label="Enter Your Username Here" />

      <v-btn
        block
        class="d-flex flex-wrap align-center justify-center"
        color="blue"
        variant="outlined"
        @click="router.push('/')"
      >
        Continue
      </v-btn>
    </v-card-item>
  </v-card>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  const router = useRouter()
</script>
