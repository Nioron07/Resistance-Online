import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EndState from '@/pages/Game/[GameID]/EndState.vue'
import { useGameStore } from '@/stores/game'
import { seedGameStore } from './helpers'

describe('EndState Cases', () => {
  it('shows "Spies Win" when winner is "spies"', () => {
    seedGameStore({ winner: 'spies' })
    const wrapper = mount(EndState)
    expect(wrapper.text()).toContain('Spies Win')
    expect(wrapper.text()).not.toContain('Resistance Wins')
  })

  it('shows "Resistance Wins" when winner is "resistance"', () => {
    seedGameStore({ winner: 'resistance' })
    const wrapper = mount(EndState)
    expect(wrapper.text()).toContain('Resistance Wins')
    expect(wrapper.text()).not.toContain('Spies Win')
  })

  it('falls back to a generic "Game Over" headline when winner is null', () => {
    seedGameStore({ winner: null })
    const wrapper = mount(EndState)
    expect(wrapper.text()).toContain('Game Over')
  })

  it('renders a Return Home action', () => {
    seedGameStore({ winner: 'spies' })
    const wrapper = mount(EndState)
    expect(wrapper.text()).toContain('Return Home')
  })

  it('the headline reflects winner changes reactively', async () => {
    const store = seedGameStore({ winner: 'spies' })
    const wrapper = mount(EndState)
    expect(wrapper.text()).toContain('Spies Win')

    store.winner = 'resistance'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Resistance Wins')
  })
})

// Sanity: the store directly exposes `winner`.
describe('EndState — store integration', () => {
  it('reads winner from the game store', () => {
    seedGameStore({ winner: 'resistance' })
    const game = useGameStore()
    expect(game.winner).toBe('resistance')
  })
})
