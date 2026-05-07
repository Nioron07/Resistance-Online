import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { VSelect } from 'vuetify/components'
import SuspicionPhase from '@/pages/Game/[GameID]/SuspicionPhase.vue'
import { useGameStore } from '@/stores/game'

describe('SuspicionPhase Cases', () => {
  it('ensure selects equal the number of spies on load', () => {
    const wrapper = mount(SuspicionPhase)
    const selects = wrapper.findAllComponents(VSelect)
    const store = useGameStore()
    expect(selects.length).toBe(store.numSpies)
  })
  it('ensure select options equal players from store plus None', () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    const selects = wrapper.findComponent(VSelect)
    expect(selects.props('items')).toStrictEqual([...store.players, 'None'])
  })
  it('ensure confidence select is added once player is selected', async () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    const select = wrapper.findComponent(VSelect)
    await select.vm.$emit('update:modelValue', store.players[0])
    await wrapper.vm.$nextTick()
    const selects = wrapper.findAllComponents(VSelect)
    expect(selects.length).toBe(store.numSpies + 1)
    expect(selects[1].props('items')).toStrictEqual(['Unsure', 'Somewhat Sure', 'Confident', 'Very Confident'])
  })
  it('ensure player list removes already selected players', async () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    const select = wrapper.findComponent(VSelect)
    await select.vm.$emit('update:modelValue', store.players[0])
    await wrapper.vm.$nextTick()
    const selects = wrapper.findAllComponents(VSelect)
    const expectedPlayers = [...store.players.filter(p => p !== store.players[0]), 'None']
    expect(selects[2].props('items')).toStrictEqual(expectedPlayers)
  })
  it('ensure suspicion emit is formatted correctly', async () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    let selects = wrapper.findAllComponents(VSelect)

    await selects[0].vm.$emit('update:modelValue', store.players[0])
    await wrapper.vm.$nextTick()
    await wrapper.find('.v-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('suspicions')).toBeTruthy()
    expect(wrapper.emitted('suspicions')![0][0]).toEqual({ [store.players[0]]: 'Unsure' })

    await selects[1].vm.$emit('update:modelValue', store.players[1])
    selects = wrapper.findAllComponents(VSelect)
    await selects[3].vm.$emit('update:modelValue', 'Confident')
    await wrapper.vm.$nextTick()
    await wrapper.find('.v-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('suspicions')).toBeTruthy()
    expect(wrapper.emitted('suspicions')![1][0]).toEqual({ [store.players[0]]: 'Unsure', [store.players[1]]: 'Confident' })

    await selects[0].vm.$emit('update:modelValue', 'None')
    await wrapper.vm.$nextTick()
    await selects[0].vm.$emit('update:modelValue', 'None')
    await wrapper.vm.$nextTick()
    await wrapper.find('.v-btn').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('suspicions')![2][0]).toEqual({})
  })
})
