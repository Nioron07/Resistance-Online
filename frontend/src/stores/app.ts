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
  /**
   * False on first SSO login — prompts the user to confirm or change
   * the Steam display name on the username-signup page. Flipped to
   * true once they POST /auth/me/username.
   */
  username_set: boolean
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

  /**
   * POST /auth/me/username — flips username_set=TRUE in the DB and updates
   * the local user. Returns null on success, or an error message string.
   */
  async function setUsername (username: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/me/username`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        return body.error ?? `HTTP ${res.status}`
      }
      // Refresh the local profile so isAuthenticated and username_set are current.
      await fetchUser()
      return null
    } catch (error) {
      return (error as Error).message
    }
  }

  return { user, loading, isAuthenticated, fetchUser, logout, loginWithSteam, setUsername }
})
