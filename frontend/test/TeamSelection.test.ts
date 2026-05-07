import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VBtn } from 'vuetify/components'
import PlayerCard from '@/components/PlayerCard.vue'
import TeamSelection from '@/pages/Game/[GameID]/TeamSelection.vue'
import { useGameStore } from '@/stores/game'
import { seedGameStore } from './helpers'

describe('TeamSelection Cases', () => {
  beforeEach(() => {
    // Default: I am the leader of a 5-player game on mission 0 (team size = 2).
    seedGameStore({ myId: 1, playerIds: [1, 2, 3, 4, 5], asLeader: true, mission: 0 })
  })

  it('renders one PlayerCard per player when I am the leader', () => {
    const wrapper = mount(TeamSelection)
    const players = wrapper.findAllComponents(PlayerCard)
    const store = useGameStore()
    expect(players.length).toBe(store.playerIds.length)
  })

  it('non-leaders see the waiting message', () => {
    const store = useGameStore()
    store.leaderId = 2 // someone else is the leader
    const wrapper = mount(TeamSelection)
    expect(wrapper.text()).toContain('is currently making team selections')
  })

  it('confirm button submits the selected team via submitNomination', async () => {
    const store = useGameStore()
    const submitSpy = vi.spyOn(store, 'submitNomination').mockImplementation(() => {})

    const wrapper = mount(TeamSelection)
    const cards = wrapper.findAllComponents(PlayerCard)

    // Pick the first `currTeamSize` players' IDs.
    const expected: number[] = []
    for (let i = 0; i < store.currTeamSize; i++) {
      await cards[i]!.find('.v-card').trigger('click')
      await wrapper.vm.$nextTick()
      expected.push(store.playerIds[i]!)
    }

    const confirm = wrapper.findAllComponents(VBtn).at(-1)!
    await confirm.trigger('click')
    await wrapper.vm.$nextTick()

    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(submitSpy).toHaveBeenCalledWith(expected)
  })

  it('caps selection at currTeamSize — extra clicks are ignored', async () => {
    const store = useGameStore()
    const submitSpy = vi.spyOn(store, 'submitNomination').mockImplementation(() => {})

    const wrapper = mount(TeamSelection)
    const cards = wrapper.findAllComponents(PlayerCard)

    // Try to click ONE more than the allowed team size.
    for (let i = 0; i < store.currTeamSize + 1; i++) {
      await cards[i]!.find('.v-card').trigger('click')
      await wrapper.vm.$nextTick()
    }

    const confirm = wrapper.findAllComponents(VBtn).at(-1)!
    await confirm.trigger('click')
    await wrapper.vm.$nextTick()

    expect(submitSpy).toHaveBeenCalledTimes(1)
    const submitted = submitSpy.mock.calls[0]![0]
    expect(submitted.length).toBe(store.currTeamSize)
  })
})
