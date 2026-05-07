<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script lang="ts" setup>
  import { onBeforeMount } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore } from '@/stores/app'

  const appStore = useAppStore()
  const router = useRouter()

  onBeforeMount(async () => {
    await appStore.fetchUser()
    if (!appStore.isAuthenticated) {
      router.push('/Login/Login')
    }
  })
</script>
