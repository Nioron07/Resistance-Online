import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VBtn } from 'vuetify/components'
import PlayerCard from '@/components/PlayerCard.vue'
import TeamVote from '@/pages/Game/[GameID]/TeamVote.vue'
import { useGameStore } from '@/stores/game'
import { seedGameStore } from './helpers'

describe('TeamVote Cases', () => {
  beforeEach(() => {
    seedGameStore({
      myId: 1,
      playerIds: [1, 2, 3, 4, 5],
      nominatedTeam: [1, 2],
    })
  })

  it('renders one PlayerCard per player on the nominated team', () => {
    const wrapper = mount(TeamVote)
    const players = wrapper.findAllComponents(PlayerCard)
    const store = useGameStore()
    expect(players.length).toBe(store.nominatedTeam.length)
  })

  it('approve button calls castVote(true) and disables further voting', async () => {
    const store = useGameStore()
    const voteSpy = vi.spyOn(store, 'castVote').mockImplementation(() => {})

    const wrapper = mount(TeamVote)
    const buttons = wrapper.findAllComponents(VBtn)
    await buttons[0]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(voteSpy).toHaveBeenCalledWith(true)
    expect(wrapper.text()).toContain('VOTE SUBMITTED')
  })

  it('reject button calls castVote(false)', async () => {
    const store = useGameStore()
    const voteSpy = vi.spyOn(store, 'castVote').mockImplementation(() => {})

    const wrapper = mount(TeamVote)
    const buttons = wrapper.findAllComponents(VBtn)
    await buttons[1]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(voteSpy).toHaveBeenCalledWith(false)
  })
})
