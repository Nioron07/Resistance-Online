<template>
  <v-container class="r-signup-wrap" max-width="540">
    <v-card class="r-signup-card pa-6">
      <header class="r-signup-header">
        <h1 class="r-signup-title">CHOOSE A USERNAME</h1>

        <p class="r-signup-sub">
          We pre-filled the name from your Steam profile. Keep it or pick something new — visible on the leaderboard and in game results.
        </p>
      </header>

      <v-text-field
        v-model="username"
        autofocus
        class="mt-3"
        density="comfortable"
        hint="3–20 characters · letters, digits, underscore"
        label="USERNAME"
        :rules="rules"
        @keyup.enter="continueOn"
      />

      <v-btn
        block
        class="mt-2 r-continue-btn"
        color="primary"
        :disabled="!isValid || saving"
        :loading="saving"
        size="large"
        variant="flat"
        @click="continueOn"
      >
        CONTINUE
      </v-btn>

      <p v-if="error" class="r-signup-error mt-2">{{ error }}</p>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore } from '@/stores/app'

  const router = useRouter()
  const appStore = useAppStore()

  const username = ref('')
  const saving = ref(false)
  const error = ref('')

  const rules = [
    (v: string) => !!v || 'Username required',
    (v: string) => v.length >= 3 || 'Too short',
    (v: string) => v.length <= 20 || 'Too long',
    (v: string) => /^[A-Za-z0-9_]+$/.test(v) || 'Letters, digits, underscore only',
  ]

  const isValid = computed(() => rules.every(r => r(username.value) === true))

  /**
   * Default to the username currently on the profile (which is the Steam
   * display name on first login). If the store finishes loading after this
   * page mounts, sync once.
   */
  function seedFromProfile () {
    if (!username.value && appStore.user?.username) {
      username.value = appStore.user.username
    }
  }
  onMounted(async () => {
    if (!appStore.user) await appStore.fetchUser()
    if (!appStore.isAuthenticated) {
      router.push('/Login/Login')
      return
    }
    // If the user already confirmed their username, this page is moot.
    if (appStore.user?.username_set === true) {
      router.push('/')
      return
    }
    seedFromProfile()
  })
  watch(() => appStore.user?.username, seedFromProfile)

  async function continueOn () {
    if (!isValid.value || saving.value) return
    saving.value = true
    error.value = ''
    const result = await appStore.setUsername(username.value)
    saving.value = false
    if (result === null) {
      router.push('/')
    } else {
      error.value = result
    }
  }
</script>

<style scoped>
.r-signup-wrap { padding-top: 64px; }
.r-signup-card {
  background-color: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgb(var(--v-theme-border)) !important;
}
.r-signup-header { text-align: center; margin-bottom: 16px; }
.r-signup-title {
  font-size: 1.4rem;
  font-weight: 300;
  letter-spacing: 0.08em;
  margin: 0;
}
.r-signup-sub {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-muted));
  letter-spacing: 0.02em;
  margin: 6px 0 0;
}
.r-continue-btn { font-weight: 500; letter-spacing: 0.1em; }
.r-signup-error {
  text-align: center;
  font-size: 0.8rem;
  color: var(--r-spy);
  letter-spacing: 0.02em;
}
</style>
