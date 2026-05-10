/**
 * plugins/vuetify.ts — custom dark theme for the Resistance Online client.
 * Mono typography, blue=resistance, red=spies. See ../styles/settings.scss
 * for matching CSS variables consumed by non-Vuetify markup.
 */
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

const resistanceDark = {
  dark: true,
  colors: {
    'background': '#0a0e14',
    'surface': '#131720',
    'surface-elevated': '#1a1f2b',
    'surface-bright': '#1a1f2b',
    'surface-light': '#1a1f2b',
    'on-background': '#cbd5e1',
    'on-surface': '#cbd5e1',
    'on-surface-muted': '#64748b',
    'primary': '#3b82f6', // resistance
    'on-primary': '#0a0e14',
    'error': '#ef4444', // spy
    'on-error': '#0a0e14',
    'success': '#10b981',
    'on-success': '#0a0e14',
    'warning': '#f59e0b',
    'on-warning': '#0a0e14',
    'info': '#38bdf8',
    'border': '#1f2937',
    'spy': '#ef4444',
    'resistance': '#3b82f6',
  },
}

const MONO_STACK = '"JetBrains Mono", "JetBrains Mono Variable", ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'

export default createVuetify({
  theme: {
    defaultTheme: 'resistanceDark',
    themes: { resistanceDark },
  },
  defaults: {
    global: { ripple: false },
    VApp: { style: `font-family: ${MONO_STACK};` },
    VBtn: {
      rounded: 'md',
      style: `font-family: ${MONO_STACK}; letter-spacing: 0.025em; font-weight: 500;`,
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
      style: 'border: 1px solid rgb(var(--v-theme-border));',
    },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VAutocomplete: { variant: 'outlined', density: 'comfortable' },
    VChip: {
      style: `font-family: ${MONO_STACK}; letter-spacing: 0.04em;`,
    },
  },
})
