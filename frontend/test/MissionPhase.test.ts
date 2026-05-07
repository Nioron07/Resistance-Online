import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { VBtn, VDialog } from 'vuetify/components'
import MissionPhase from '@/pages/Game/[GameID]/MissionPhase.vue'

describe('MissionsPhase Cases', () => {
  it('renders both buttons', () => {
    const wrapper = mount(MissionPhase)
    expect(wrapper.text()).toContain('Success')
    expect(wrapper.text()).toContain('Fail')
    expect(wrapper.text()).toContain('Select a mission outcome')

    const buttons = wrapper.findAllComponents(VBtn)
    expect(buttons.length).toBe(2)
  })
  it('click renders dialog', async () => {
    const wrapper = mount(MissionPhase)
    await wrapper.find('.v-btn').trigger('click')
    const dialog = wrapper.findComponent(VDialog)
    expect(dialog.exists()).toBe(true)
  })
})
