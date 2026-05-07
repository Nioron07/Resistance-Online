import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VBtn, VSelect } from 'vuetify/components'
import SuspicionPhase from '@/pages/Game/[GameID]/SuspicionPhase.vue'
import { useGameStore } from '@/stores/game'
import { seedGameStore } from './helpers'

describe('SuspicionPhase Cases', () => {
  beforeEach(() => {
    seedGameStore({ myId: 1, playerIds: [1, 2, 3, 4, 5] })
  })

  it('renders one player-select per spy slot on load', () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    const selects = wrapper.findAllComponents(VSelect)
    // One select per spy slot (5-player game has 2 spies).
    expect(selects.length).toBe(store.numSpies)
  })

  it('player-select options exclude my own id and include a None entry', () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    const firstSelect = wrapper.findAllComponents(VSelect)[0]!
    const items = firstSelect.props('items') as Array<{ label: string, value: number | null }>
    const values = items.map(i => i.value)
    expect(values).toContain(null) // None
    expect(values).not.toContain(store.myId)
    // Each non-None entry must correspond to a real player.
    for (const v of values) {
      if (v !== null) {
        expect(store.playerIds).toContain(v)
      }
    }
  })

  it('selecting a player reveals a confidence dropdown for that slot', async () => {
    const wrapper = mount(SuspicionPhase)
    const store = useGameStore()
    const targetId = store.playerIds.find(id => id !== store.myId)!

    const firstSelect = wrapper.findAllComponents(VSelect)[0]!
    await firstSelect.vm.$emit('update:model-value', targetId)
    await wrapper.vm.$nextTick()

    const selects = wrapper.findAllComponents(VSelect)
    // numSpies player-selects + one new confidence select for the chosen slot.
    expect(selects.length).toBe(store.numSpies + 1)
  })

  it('submitting flushes the selections through submitSuspicions', async () => {
    const store = useGameStore()
    const submitSpy = vi.spyOn(store, 'submitSuspicions').mockImplementation(() => {})

    const wrapper = mount(SuspicionPhase)
    const targetId = store.playerIds.find(id => id !== store.myId)!

    const firstSelect = wrapper.findAllComponents(VSelect)[0]!
    await firstSelect.vm.$emit('update:model-value', targetId)
    await wrapper.vm.$nextTick()

    const submitBtn = wrapper.findAllComponents(VBtn).at(-1)!
    await submitBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(submitSpy).toHaveBeenCalledTimes(1)
    const payload = submitSpy.mock.calls[0]![0] as Record<number, number>
    expect(payload[targetId]).toBeGreaterThanOrEqual(1) // default confidence is 1
  })
})
