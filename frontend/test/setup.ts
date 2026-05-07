import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
// AI generated global test setup for Pinia and Vuetify plugin initialization
import { beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'

// Stub visualViewport for Vuetify overlay/dialog components in happy-dom
if (!globalThis.visualViewport) {
  globalThis.visualViewport = {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    scale: 1,
    pageLeft: 0,
    pageTop: 0,
    onresize: null,
    onscroll: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as VisualViewport
}

const vuetify = createVuetify()

beforeEach(() => {
  setActivePinia(createPinia())
})

config.global.plugins = [vuetify]
