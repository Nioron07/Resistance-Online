import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MetricCard from '@/components/MetricCard.vue'

describe('MetricCard', () => {
  it('renders label, value, and hint', () => {
    const wrapper = mount(MetricCard, { props: { label: 'P-INDEX', value: 4.32, hint: '22 games' } })
    expect(wrapper.text()).toContain('P-INDEX')
    expect(wrapper.text()).toContain('4.32')
    expect(wrapper.text()).toContain('22 games')
  })

  it('shows "—" for null value', () => {
    const wrapper = mount(MetricCard, { props: { label: 'X', value: null } })
    expect(wrapper.text()).toContain('—')
  })

  it('formats numbers at the requested precision', () => {
    const wrapper = mount(MetricCard, { props: { label: 'X', value: 1.234_56, precision: 4 } })
    expect(wrapper.text()).toContain('1.2346')
  })

  it('renders a positive delta with a + sign and success color', () => {
    const wrapper = mount(MetricCard, { props: { label: 'X', value: 5, delta: 1.5 } })
    expect(wrapper.text()).toContain('+1.50')
    const delta = wrapper.find('.metric-delta')
    expect(delta.classes()).toContain('text-success')
  })

  it('renders a negative delta with the error color', () => {
    const wrapper = mount(MetricCard, { props: { label: 'X', value: 5, delta: -1.5 } })
    expect(wrapper.find('.metric-delta').classes()).toContain('text-error')
  })

  it('color-value-by-sign tints positive values green', () => {
    const wrapper = mount(MetricCard, { props: { label: 'X', value: 7, colorValueBySign: true } })
    expect(wrapper.find('.metric-value').classes()).toContain('text-success')
  })

  it('renders a string value verbatim', () => {
    const wrapper = mount(MetricCard, { props: { label: 'X', value: '— pending —' } })
    expect(wrapper.text()).toContain('— pending —')
  })
})
