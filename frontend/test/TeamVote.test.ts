import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import PlayerCard from '@/components/PlayerCard.vue'
import TeamVote from '@/pages/Game/[GameID]/TeamVote.vue'
import { useGameStore } from '@/stores/game'

describe('TeamVote Cases', () => {
  it('ensure PlayerCards equal num of players on team', () => {
    const wrapper = mount(TeamVote)
    const players = wrapper.findAllComponents(PlayerCard)
    const store = useGameStore()
    expect(players.length).toBe(store.currTeam.length)
  })
})
