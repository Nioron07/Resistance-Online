<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script lang="ts" setup>
  import { onBeforeMount } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAppStore } from '@/stores/app'

  const appStore = useAppStore()
  const router = useRouter()
  const route = useRoute()

  onBeforeMount(async () => {
    await appStore.fetchUser()
    if (!appStore.isAuthenticated) {
      // Don't bounce away from login or signup pages.
      if (!route.path.startsWith('/Login')) {
        router.push('/Login/Login')
      }
      return
    }

    /**
     * First-time SSO sign-up: the backend defaults `username_set` to FALSE
     * and seeds username from the Steam display name. Send the player to the
     * confirmation page (unless they're already there).
     */
    if (appStore.user && appStore.user.username_set === false && route.path !== '/Login/UserNameSignup') {
      router.push('/Login/UserNameSignup')
    }
  })
</script>
