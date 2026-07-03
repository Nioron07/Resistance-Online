<template>
  <!-- Desktop: slim left rail -->
  <v-navigation-drawer
    v-if="!display.smAndDown.value"
    class="r-nav"
    :elevation="0"
    expand-on-hover
    permanent
    rail
  >
    <v-list>
      <v-list-item
        v-if="appStore.isAuthenticated"
        :prepend-avatar="appStore.user?.pfp"
        :subtitle="userIdLabel"
        :title="appStore.user?.username"
      />

      <v-list-item
        v-else
        prepend-icon="mdi-account-circle"
        subtitle="Not signed in"
        title="Guest"
      />
    </v-list>

    <v-divider />

    <v-list density="compact" nav>
      <v-list-item
        :active="route.path === '/'"
        prepend-icon="mdi-home"
        title="Home"
        @click="router.push('/')"
      />

      <v-list-item
        :active="route.path.startsWith('/Leaderboard')"
        prepend-icon="mdi-trophy"
        title="Leaderboard"
        @click="router.push('/Leaderboard')"
      />

      <v-list-item
        :active="route.path.startsWith('/Search')"
        prepend-icon="mdi-magnify"
        title="Search"
        @click="router.push('/Search')"
      />

      <template v-if="appStore.isAuthenticated">
        <v-list-item
          :active="route.path.startsWith('/Profile')"
          prepend-icon="mdi-chart-bar"
          title="My Stats"
          @click="router.push(`/Profile/${appStore.user?.username}`)"
        />

        <v-list-item
          prepend-icon="mdi-logout"
          title="Logout"
          @click="logout"
        />
      </template>

      <template v-else>
        <v-list-item
          prepend-icon="mdi-login"
          title="Login"
          @click="router.push('/Login/Login')"
        />
      </template>
    </v-list>

    <!-- Bottom-anchored About link. The drawer's `append` slot renders at
         the bottom of the rail, separated by a divider. -->
    <template #append>
      <v-divider />

      <v-list density="compact" nav>
        <v-list-item
          :active="route.path.startsWith('/About')"
          prepend-icon="mdi-information-outline"
          title="About"
          @click="router.push('/About')"
        />
      </v-list>
    </template>
  </v-navigation-drawer>

  <!-- Mobile: top app bar with drawer menu -->
  <v-app-bar v-else class="r-mobile-bar" density="compact" flat>
    <v-app-bar-title class="r-mobile-title">
      {{ pageTitle }}
    </v-app-bar-title>

    <v-menu>
      <template #activator="{ props }">
        <v-btn icon v-bind="props">
          <v-icon>mdi-menu</v-icon>
        </v-btn>
      </template>

      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-home"
          title="Home"
          @click="router.push('/')"
        />

        <v-list-item
          prepend-icon="mdi-trophy"
          title="Leaderboard"
          @click="router.push('/Leaderboard')"
        />

        <v-list-item
          prepend-icon="mdi-magnify"
          title="Search"
          @click="router.push('/Search')"
        />

        <template v-if="appStore.isAuthenticated">
          <v-list-item
            prepend-icon="mdi-chart-bar"
            title="My Stats"
            @click="router.push(`/Profile/${appStore.user?.username}`)"
          />

          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            @click="logout"
          />
        </template>

        <template v-else>
          <v-list-item
            prepend-icon="mdi-login"
            title="Login"
            @click="router.push('/Login/Login')"
          />
        </template>

        <v-divider class="my-1" />

        <v-list-item
          prepend-icon="mdi-information-outline"
          title="About"
          @click="router.push('/About')"
        />
      </v-list>
    </v-menu>
  </v-app-bar>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useAppStore } from '@/stores/app'

  const display = useDisplay()
  const router = useRouter()
  const route = useRoute()
  const appStore = useAppStore()

  const userIdLabel = computed(() =>
    appStore.user?.id ? `#${appStore.user.id}` : '',
  )

  /** Await the logout so the session cookie is cleared before the guard re-runs. */
  async function logout () {
    await appStore.logout()
    router.push('/Login/Login')
  }

  const pageTitle = computed(() => {
    const p = route.path
    if (p === '/') return 'Resistance'
    if (p.startsWith('/Leaderboard')) return 'Leaderboard'
    if (p.startsWith('/Search')) return 'Search'
    if (p.startsWith('/Profile')) return 'My Stats'
    if (p.startsWith('/Game')) return 'Game'
    if (p.startsWith('/Login')) return 'Sign In'
    if (p.startsWith('/About')) return 'About'
    return 'Resistance'
  })
</script>

<style scoped>
.r-nav {
  background-color: rgb(var(--v-theme-surface)) !important;
  border-right: 1px solid rgb(var(--v-theme-border)) !important;
}
.r-mobile-bar {
  background-color: rgb(var(--v-theme-surface)) !important;
  border-bottom: 1px solid rgb(var(--v-theme-border)) !important;
}
.r-mobile-title {
  font-weight: 500;
  letter-spacing: 0.04em;
}
</style>
