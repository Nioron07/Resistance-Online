import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { VBtn, VDialog } from 'vuetify/components'
import IdentitySelection from '@/pages/Game/[GameID]/IdentitySelection.vue'

describe('IdentitySelection Cases', () => {
  it('renders both buttons', () => {
    const wrapper = mount(IdentitySelection)
    expect(wrapper.text()).toContain('SPY')
    expect(wrapper.text()).toContain('RESISTANCE')
    expect(wrapper.text()).toContain('SELECT YOUR IDENTITY')

    const buttons = wrapper.findAllComponents(VBtn)
    expect(buttons.length).toBe(2)
  })
  it('click renders dialog', async () => {
    const wrapper = mount(IdentitySelection)
    await wrapper.find('.v-btn').trigger('click')
    const dialog = wrapper.findComponent(VDialog)
    expect(dialog.exists()).toBe(true)
  })
})
