/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue` plus a global auth guard.
 */

import { setupLayouts } from 'virtual:generated-layouts'
// Composables
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { useAppStore } from '@/stores/app'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts(routes),
})

let firstAuthChecked = false

/**
 * Auth gate. Run before every navigation; nothing renders for an
 * unauthenticated visitor outside of /Login/*. Also enforces the
 * username-confirmation step (username_set === false → /Login/UserNameSignup).
 */
router.beforeEach(async to => {
  const appStore = useAppStore()

  // Lazily kick off the first /auth/me fetch. Only awaited once.
  if (!firstAuthChecked) {
    firstAuthChecked = true
    await appStore.fetchUser()
  } else if (appStore.loading) {
    // Another navigation is mid-flight — wait it out so we don't race.
    await new Promise<void>(resolve => {
      const tick = setInterval(() => {
        if (!appStore.loading) {
          clearInterval(tick)
          resolve()
        }
      }, 20)
    })
  }

  const path = to.path
  const isLoginRoute = path.startsWith('/Login/')
  // Public pages — accessible without authentication.
  const isPublicRoute = path === '/About' || path.startsWith('/About/')

  if (!appStore.isAuthenticated) {
    return (isLoginRoute || isPublicRoute) ? true : { path: '/Login/Login' }
  }

  // Authenticated but hasn't confirmed their username yet — funnel them
  // through the signup page until they do.
  if (appStore.user?.username_set === false) {
    return path === '/Login/UserNameSignup' ? true : { path: '/Login/UserNameSignup' }
  }

  // Already confirmed; don't let them sit on the signup page.
  if (path === '/Login/UserNameSignup') {
    return { path: '/' }
  }

  return true
})

// Workaround for https://github.com/vitejs/vite/issues/11804
router.onError((err, to) => {
  if (err?.message?.includes?.('Failed to fetch dynamically imported module')) {
    if (localStorage.getItem('vuetify:dynamic-reload')) {
      console.error('Dynamic import error, reloading page did not fix it', err)
    } else {
      console.log('Reloading page to fix dynamic import error')
      localStorage.setItem('vuetify:dynamic-reload', 'true')
      location.assign(to.fullPath)
    }
  } else {
    console.error(err)
  }
})

router.isReady().then(() => {
  localStorage.removeItem('vuetify:dynamic-reload')
})

export default router
