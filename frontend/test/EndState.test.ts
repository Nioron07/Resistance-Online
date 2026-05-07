import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { VDataTable } from 'vuetify/components'
import EndState from '@/pages/Game/[GameID]/EndState.vue'
import { useGameStore } from '@/stores/game'
describe('EndState Cases', () => {
  it('shows Spies Win when spyWin is true', () => {
    const game = useGameStore()
    game.spyWin = true

    const wrapper = mount(EndState)
    expect(wrapper.text()).toContain('Spies Win')
    expect(wrapper.text()).not.toContain('Resistance Wins')
  })

  it('shows Resistance Wins when spyWin is false', () => {
    const game = useGameStore()
    game.spyWin = false

    const wrapper = mount(EndState)
    expect(wrapper.text()).not.toContain('Spies Win')
    expect(wrapper.text()).toContain('Resistance Wins')
  })

  it('shows Placeholder table', () => {
    const game = useGameStore()
    game.spyWin = true

    const wrapper = mount(EndState)
    const table = wrapper.findComponent(VDataTable)
    expect(table.exists()).toBe(true)
  })
})
