import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { VChip, VIcon, VImg } from 'vuetify/components'
import PlayerCard from '@/components/PlayerCard.vue'

describe('PlayerCard Cases', () => {
  it('shows passed in username', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        username: 'Testing Username',
      },
    })
    expect(wrapper.text()).toContain('Testing Username')
  })
  it('shows passed in avatar', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        avatar: 'https://cdn.vuetifyjs.com/images/profiles/marcus.jpg',
      },
    })
    const image = wrapper.findComponent(VImg)
    expect(image.exists()).toBe(true)
    expect(image.props('src')).toBe('https://cdn.vuetifyjs.com/images/profiles/marcus.jpg')
  })
  it('shows passed in single record', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        record: {
          2: 'red',
        },
      },
    })
    const chip = wrapper.findComponent(VChip)
    expect(chip.exists()).toBe(true)
    expect(chip.props('color')).toBe('red')
    expect(chip.text()).toContain('2')
  })
  it('shows passed in multiple record', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        record: {
          2: 'red',
          4: 'blue',
          5: 'blue',
        },
      },
    })
    const chip = wrapper.findAllComponents(VChip)
    expect(chip[0].exists()).toBe(true)
    expect(chip[0].props('color')).toBe('red')
    expect(chip[0].text()).toContain('2')

    expect(chip[1].exists()).toBe(true)
    expect(chip[1].props('color')).toBe('blue')
    expect(chip[1].text()).toContain('4')

    expect(chip[2].exists()).toBe(true)
    expect(chip[2].props('color')).toBe('blue')
    expect(chip[2].text()).toContain('5')
  })

  it('shows icon when selected and selectable', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        selected: true,
        selectable: true,
      },
    })
    const icon = wrapper.findComponent(VIcon)
    expect(icon.exists()).toBe(true)
  })
  it('doesn\'t show icon when selected and not selectable', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        selected: true,
        selectable: false,
      },
    })
    const icon = wrapper.findComponent(VIcon)
    expect(icon.exists()).not.toBe(true)
  })
  it('doesn\'t show icon when not selected but selectable', () => {
    const wrapper = mount(PlayerCard, {
      props: {
        selected: false,
        selectable: true,
      },
    })
    const icon = wrapper.findComponent(VIcon)
    expect(icon.exists()).not.toBe(true)
  })
  it('emits select when selectable card is clicked', async () => {
    const wrapper = mount(PlayerCard, {
      props: {
        selectable: true,
      },
    })
    await wrapper.find('.v-card').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })

  it('does not emit select when not selectable', async () => {
    const wrapper = mount(PlayerCard, {
      props: {
        selectable: false,
      },
    })
    await wrapper.find('.v-card').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('comprehensive test', async () => {
    const wrapper = mount(PlayerCard, {
      props: {
        username: 'Testing Username',
        avatar: 'https://cdn.vuetifyjs.com/images/profiles/marcus.jpg',
        record: {
          2: 'red',
          4: 'blue',
          5: 'blue',
        },
        selectable: false,
      },
    })
    expect(wrapper.text()).toContain('Testing Username')

    const image = wrapper.findComponent(VImg)
    expect(image.exists()).toBe(true)
    expect(image.props('src')).toBe('https://cdn.vuetifyjs.com/images/profiles/marcus.jpg')

    const chip = wrapper.findAllComponents(VChip)
    expect(chip[0].exists()).toBe(true)
    expect(chip[0].props('color')).toBe('red')
    expect(chip[0].text()).toContain('2')

    expect(chip[1].exists()).toBe(true)
    expect(chip[1].props('color')).toBe('blue')
    expect(chip[1].text()).toContain('4')

    expect(chip[2].exists()).toBe(true)
    expect(chip[2].props('color')).toBe('blue')
    expect(chip[2].text()).toContain('5')

    await wrapper.find('.v-card').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()

    const icon1 = wrapper.findComponent(VIcon)
    expect(icon1.exists()).not.toBe(true)

    await wrapper.setProps({ selectable: true })

    const icon2 = wrapper.findComponent(VIcon)
    expect(icon2.exists()).not.toBe(true)

    await wrapper.find('.v-card').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.setProps({ selected: true })
    const icon3 = wrapper.findComponent(VIcon)
    expect(icon3.exists()).toBe(true)
  })
})
