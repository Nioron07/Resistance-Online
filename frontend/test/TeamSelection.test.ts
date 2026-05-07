import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { VBtn } from 'vuetify/components'
import PlayerCard from '@/components/PlayerCard.vue'
import TeamSelection from '@/pages/Game/[GameID]/TeamSelection.vue'
import { useGameStore } from '@/stores/game'

describe('TeamSelection Cases', () => {
  it('ensure PlayerCards equal num of players', () => {
    const wrapper = mount(TeamSelection)
    const players = wrapper.findAllComponents(PlayerCard)
    const store = useGameStore()
    expect(players.length).toBe(store.players.length)
  })
  it('ensure regualar players get waiting message', () => {
    const store = useGameStore()
    store.isHost = false
    const wrapper = mount(TeamSelection)
    expect(wrapper.text()).toContain('The leader is currently making team selections')
  })
  it('ensure selected player emit works properly', async () => {
    const wrapper = mount(TeamSelection)
    const players = wrapper.findAllComponents(PlayerCard)
    const store = useGameStore()
    const testPlayers: string[] = []
    for (let i = 0; i < store.currTeamSize; i++) {
      await players[i].trigger('click')
      await wrapper.vm.$nextTick()
      testPlayers.push(players[i].props('username'))
    }
    const button = wrapper.findComponent(VBtn)
    await button.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('selected-team')![0][0]).toEqual(testPlayers)
  })

  it('ensure selected player number caps at max team size', async () => {
    const wrapper = mount(TeamSelection)
    const players = wrapper.findAllComponents(PlayerCard)
    const store = useGameStore()
    const testPlayers: string[] = []
    for (let i = 0; i < store.currTeamSize + 1; i++) {
      await players[i].trigger('click')
      await wrapper.vm.$nextTick()
      if (i != store.currTeamSize) {
        testPlayers.push(players[i].props('username'))
      }
    }
    const button = wrapper.findComponent(VBtn)
    await button.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('selected-team')![0][0].length).toEqual(store.currTeamSize)
    expect(wrapper.emitted('selected-team')![0][0]).toEqual(testPlayers)
  })
})
