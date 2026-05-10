<template>
  <v-container class="r-login-wrap" max-width="540">
    <v-card class="r-login-card pa-6">
      <header class="r-login-header">
        <h1 class="r-login-title">SIGN IN</h1>
        <p class="r-login-sub">Your username and avatar come from your provider.</p>
      </header>

      <v-btn
        block
        class="r-provider-btn mt-3"
        color="primary"
        prepend-icon="mdi-steam"
        size="large"
        variant="flat"
        @click="appStore.loginWithSteam()"
      >
        CONTINUE WITH STEAM
      </v-btn>

      <v-btn
        block
        class="r-provider-btn mt-3"
        prepend-icon="mdi-google"
        size="large"
        variant="outlined"
        @click="appStore.loginWithGoogle()"
      >
        CONTINUE WITH GOOGLE
      </v-btn>

      <p class="r-login-foot">
        We don't post to your account. Cookies stay on this site.
      </p>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import { useAppStore } from '@/stores/app'
  const appStore = useAppStore()
</script>

<style scoped>
.r-login-wrap { padding-top: 64px; }
.r-login-card {
  background-color: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgb(var(--v-theme-border)) !important;
}
.r-login-header { text-align: center; margin-bottom: 16px; }
.r-login-title {
  font-size: 1.6rem;
  font-weight: 300;
  letter-spacing: 0.08em;
  margin: 0;
}
.r-login-sub {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.04em;
  margin: 4px 0 0;
}
.r-provider-btn { font-weight: 500; letter-spacing: 0.1em; }
.r-login-foot {
  margin-top: 16px;
  text-align: center;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: rgb(var(--v-theme-on-surface-muted));
}
</style>
