/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Composables
import { createApp } from 'vue'

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Styles
import 'unfonts.css'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

fetch('/ping')
  .then(res => res.text())
  .then(body => console.log(`[ping] ${body.trim()}`))
  .catch(err => console.error('[ping] failed', err))
