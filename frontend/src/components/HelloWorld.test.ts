import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import HelloWorld from './HelloWorld.vue'

describe('HelloWorld', () => {
  const vuetify = createVuetify({
    components,
    directives,
  })

  it('renders welcome message', () => {
    const wrapper = mount(HelloWorld, {
      global: {
        plugins: [vuetify],
      },
    })

    expect(wrapper.text()).toContain('Welcome to')
    expect(wrapper.text()).toContain('Vuetify')
  })

  it('renders the get started card', () => {
    const wrapper = mount(HelloWorld, {
      global: {
        plugins: [vuetify],
      },
    })

    expect(wrapper.text()).toContain('Get started')
  })

  it('renders all documentation links', () => {
    const wrapper = mount(HelloWorld, {
      global: {
        plugins: [vuetify],
      },
    })

    expect(wrapper.text()).toContain('Documentation')
    expect(wrapper.text()).toContain('Features')
    expect(wrapper.text()).toContain('Components')
    expect(wrapper.text()).toContain('Community')
  })

  it('renders the Vuetify logo', () => {
    const wrapper = mount(HelloWorld, {
      global: {
        plugins: [vuetify],
      },
    })

    const img = wrapper.findComponent({ name: 'VImg' })
    expect(img.exists()).toBe(true)
  })
})
