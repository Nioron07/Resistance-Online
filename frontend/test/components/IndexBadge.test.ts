import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import IndexBadge from '@/components/IndexBadge.vue'

describe('IndexBadge', () => {
  it('formats positive with leading +', () => {
    const w = mount(IndexBadge, { props: { value: 1.234 } })
    expect(w.text()).toContain('+1.23')
    expect(w.classes()).toContain('index-up')
  })

  it('formats negative with sign and red coloring', () => {
    const w = mount(IndexBadge, { props: { value: -2.5 } })
    expect(w.text()).toContain('-2.50')
    expect(w.classes()).toContain('index-down')
  })

  it('shows — for null', () => {
    const w = mount(IndexBadge, { props: { value: null } })
    expect(w.text()).toContain('—')
    expect(w.classes()).toContain('index-neutral')
  })

  it('hides the leading + when showPlus is false', () => {
    const w = mount(IndexBadge, { props: { value: 3.14, showPlus: false } })
    expect(w.text()).not.toContain('+')
    expect(w.text()).toContain('3.14')
  })
})
