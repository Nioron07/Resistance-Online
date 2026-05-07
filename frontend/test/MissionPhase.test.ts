import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { VBtn, VDialog } from 'vuetify/components'
import MissionPhase from '@/pages/Game/[GameID]/MissionPhase.vue'
import { useGameStore } from '@/stores/game'
import { seedGameStore } from './helpers'

describe('MissionsPhase Cases', () => {
  beforeEach(() => {
    // Make me a member of the active mission team.
    seedGameStore({
      myId: 1,
      playerIds: [1, 2, 3, 4, 5],
      nominatedTeam: [1, 2],
    })
  })

  it('shows the waiting card if I am NOT on the team', () => {
    const store = useGameStore()
    store.nominatedTeam = [2, 3]
    const wrapper = mount(MissionPhase)
    expect(wrapper.text()).toContain('Mission in Progress')
    expect(wrapper.text()).not.toContain('Select a mission outcome')
  })

  it('renders Success and Fail buttons when I am on the team', () => {
    const wrapper = mount(MissionPhase)
    expect(wrapper.text()).toContain('Success')
    expect(wrapper.text()).toContain('Fail')
    expect(wrapper.text()).toContain('Select a mission outcome')

    const buttons = wrapper.findAllComponents(VBtn)
    // Two action buttons in the v-card-text + two confirm/cancel inside the dialog.
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('clicking a button opens the confirmation dialog', async () => {
    const wrapper = mount(MissionPhase)
    await wrapper.find('.v-btn').trigger('click')
    await wrapper.vm.$nextTick()
    const dialog = wrapper.findComponent(VDialog)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('modelValue')).toBe(true)
  })

  it('the Success button is rendered as one of the two large outcome buttons', () => {
    const wrapper = mount(MissionPhase)
    const visibleSuccess = wrapper.findAll('button').filter(b => b.text() === 'Success')
    const visibleFail = wrapper.findAll('button').filter(b => b.text() === 'Fail')
    // The component randomizes order but always shows exactly one of each.
    expect(visibleSuccess.length).toBe(1)
    expect(visibleFail.length).toBe(1)
  })
})
