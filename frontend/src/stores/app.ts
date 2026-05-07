import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const API_BASE = ''

interface UserProfile {
  id: number
  username: string
  pfp: string
  bio: string
  friends: unknown
  count_games: number
  count_games_won: number
  game_metrics: unknown
  overall_metrics: unknown
  connections: unknown
  last_played: string
  creation_date: string
}

export const useAppStore = defineStore('app', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const isAuthenticated = computed(() => user.value !== null)

  async function fetchUser () {
    loading.value = true
    try {
      const res = await fetch(`${API_BASE}/auth/me?verbosity=1`, {
        credentials: 'include',
      })
      user.value = res.ok ? await res.json() : null
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function logout () {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      user.value = null
    }
  }

  function loginWithSteam () {
    window.location.href = `${API_BASE}/auth/login/steam`
  }

  return { user, loading, isAuthenticated, fetchUser, logout, loginWithSteam }
})
