import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GameOutcomeChip from '@/components/GameOutcomeChip.vue'

describe('GameOutcomeChip', () => {
  it('renders RESISTANCE WINS in resistance color', () => {
    const w = mount(GameOutcomeChip, { props: { winner: 'resistance' } })
    expect(w.text()).toContain('RESISTANCE WINS')
    expect(w.classes()).toContain('outcome-resistance')
  })

  it('renders SPIES WIN in spy color', () => {
    const w = mount(GameOutcomeChip, { props: { winner: 'spies' } })
    expect(w.text()).toContain('SPIES WIN')
    expect(w.classes()).toContain('outcome-spy')
  })

  it('renders IN PROGRESS for null winner', () => {
    const w = mount(GameOutcomeChip, { props: { winner: null } })
    expect(w.text()).toContain('IN PROGRESS')
    expect(w.classes()).toContain('outcome-neutral')
  })

  it('shows the optional reason line', () => {
    const w = mount(GameOutcomeChip, { props: { winner: 'resistance', reason: 'MISSION VICTORY' } })
    expect(w.text()).toContain('MISSION VICTORY')
  })
})
