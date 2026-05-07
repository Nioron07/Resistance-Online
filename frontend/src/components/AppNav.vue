<template>
  <!-- This the Nav for PC jit -->
  <v-navigation-drawer v-if="!display.smAndDown.value" expand-on-hover permanent rail>
    <v-list>
      <v-list-item
        v-if="appStore.isAuthenticated"
        :prepend-avatar="appStore.user?.pfp"
        :title="appStore.user?.username"
      />

      <v-list-item
        v-else
        prepend-icon="mdi-account-circle"
        title="Guest"
      />
    </v-list>

    <v-divider />

    <v-list density="compact" nav>
      <v-list-item prepend-icon="mdi-home" title="Home" value="home" @click="router.push('/')" />
      <!--      <v-list-item prepend-icon="mdi-trophy" title="Leaderboard" value="leaderboard" @click="router.push('/Leaderboard')" /> -->

      <template v-if="appStore.isAuthenticated">
        <v-list-item prepend-icon="mdi-chart-bar" title="My Stats" value="stats" @click="router.push(`/Profile/${appStore.user?.username}`)" />
        <v-list-item prepend-icon="mdi-logout" title="Logout" value="logout" @click="appStore.logout()" />
      </template>

      <template v-else>
        <v-list-item prepend-icon="mdi-login" title="Login" value="login" @click="router.push('/Login/Login')" />
      </template>
    </v-list>
  </v-navigation-drawer>

  <!-- This the Mobile jit -->
  <v-app-bar v-else>
    <v-app-bar-title>
      {{ appStore.isAuthenticated ? appStore.user?.username : 'Account' }}
    </v-app-bar-title>

    <v-menu>
      <template #activator="{ props }">
        <v-btn icon v-bind="props">
          <v-icon>mdi-menu</v-icon>
        </v-btn>
      </template>

      <v-list density="compact" nav>
        <v-list-item prepend-icon="mdi-home" title="Home" value="home" @click="router.push('/')" />
        <v-list-item prepend-icon="mdi-trophy" title="Leaderboard" value="leaderboard" @click="router.push('/Leaderboard')" />

        <template v-if="appStore.isAuthenticated">
          <v-list-item prepend-icon="mdi-chart-bar" title="My Stats" value="stats" @click="router.push(`/Profile/${appStore.user?.username}`)" />
          <v-list-item prepend-icon="mdi-logout" title="Logout" value="logout" @click="appStore.logout()" />
        </template>

        <template v-else>
          <v-list-item prepend-icon="mdi-login" title="Login" value="login" @click="router.push('/Login/Login')" />
        </template>
      </v-list>
    </v-menu>
  </v-app-bar>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useAppStore } from '@/stores/app'

  const display = useDisplay()
  const router = useRouter()
  const appStore = useAppStore()
</script>
