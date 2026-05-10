import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlayerRoleTag from '@/components/PlayerRoleTag.vue'

describe('PlayerRoleTag', () => {
  it('shows the role uppercased', () => {
    const w = mount(PlayerRoleTag, { props: { role: 'commander' } })
    expect(w.text()).toContain('COMMANDER')
  })

  it('replaces hyphens with spaces (multi-word roles)', () => {
    const w = mount(PlayerRoleTag, { props: { role: 'false-commander' } })
    expect(w.text()).toContain('FALSE COMMANDER')
  })

  it('side-only rendering collapses to RESISTANCE / SPY', () => {
    expect(mount(PlayerRoleTag, { props: { role: 'commander', sideOnly: true } }).text()).toContain('RESISTANCE')
    expect(mount(PlayerRoleTag, { props: { role: 'assassin', sideOnly: true } }).text()).toContain('SPY')
  })

  it('classifies known spy roles as the spy side', () => {
    const w = mount(PlayerRoleTag, { props: { role: 'deep-cover' } })
    expect(w.classes()).toContain('role-spy')
  })

  it('UNKNOWN when role is missing', () => {
    const w = mount(PlayerRoleTag, { props: { role: null } })
    expect(w.text()).toContain('UNKNOWN')
    expect(w.classes()).toContain('role-unknown')
  })
})
