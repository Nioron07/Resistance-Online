import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MissionTracker from '@/components/MissionTracker.vue'

describe('MissionTracker', () => {
  it('renders exactly five circles regardless of input length', () => {
    const w = mount(MissionTracker, { props: { outcomes: [true] } })
    expect(w.findAll('.mission-circle')).toHaveLength(5)
  })

  it('classifies success / fail / pending correctly', () => {
    const w = mount(MissionTracker, { props: { outcomes: [true, false, null, undefined, true] } })
    const circles = w.findAll('.mission-circle')
    expect(circles[0]!.classes()).toContain('circle-success')
    expect(circles[1]!.classes()).toContain('circle-fail')
    expect(circles[2]!.classes()).toContain('circle-pending')
    expect(circles[3]!.classes()).toContain('circle-pending')
    expect(circles[4]!.classes()).toContain('circle-success')
  })

  it('passes through dense styling', () => {
    const w = mount(MissionTracker, { props: { outcomes: [true], dense: true } })
    expect(w.findAll('.mission-circle')[0]!.classes()).toContain('circle-dense')
  })

  it('numbers each circle 1..5', () => {
    const w = mount(MissionTracker, { props: { outcomes: [] } })
    const indices = w.findAll('.mission-index').map(n => n.text())
    expect(indices).toEqual(['1', '2', '3', '4', '5'])
  })
})
