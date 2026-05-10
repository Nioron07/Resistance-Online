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
import '@fontsource/jetbrains-mono/300.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@/styles/settings.scss'

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

fetch('/ping')
  .then(res => res.text())
  .then(body => console.log(`[ping] ${body.trim()}`))
  .catch(error => console.error('[ping] failed', error))
