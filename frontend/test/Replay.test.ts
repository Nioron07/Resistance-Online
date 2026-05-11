import type * as Api from '@/services/api'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Replay from '@/pages/Game/[GameID]/Replay.vue'
import * as api from '@/services/api'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { GameID: '42' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/api', async orig => {
  const real = await orig<typeof Api>()
  return { ...real, fetchGameReplay: vi.fn() }
})

function makePayload (): api.GameReplay {
  return {
    gameid: 42,
    startTimestamp: '2026-05-01T10:00:00Z',
    endTimestamp: '2026-05-01T10:30:00Z',
    outcome: {
      winner: 'resistance',
      outcomeType: 'mission-victory',
      missionStatuses: [true, false, true, true, null],
    },
    players: [
      { userid: 1, username: 'Alice', pfp: null, role: 'resistance', side: 'resistance' },
      { userid: 2, username: 'Bob', pfp: null, role: 'resistance', side: 'resistance' },
      { userid: 3, username: 'Carol', pfp: null, role: 'commander', side: 'resistance' },
      { userid: 4, username: 'Dan', pfp: null, role: 'spy', side: 'spy' },
      { userid: 5, username: 'Eve', pfp: null, role: 'assassin', side: 'spy' },
    ],
    rounds: [
      {
        roundId: 1, missionIndex: 1, nominationAttempt: 1,
        leaderUserid: 1, team: [1, 4], countSpiesNominated: 1,
        votePoll: { 1: true, 2: true, 3: false, 4: true, 5: false },
        voteStatus: true, missionStatus: true,
        missionCards: { 1: 'success', 4: 'success' },
        suspicions: null,
      },
      {
        roundId: 2, missionIndex: 2, nominationAttempt: 1,
        leaderUserid: 2, team: [2, 4, 5], countSpiesNominated: 2,
        votePoll: { 1: true, 2: true, 3: true, 4: true, 5: false },
        voteStatus: true, missionStatus: false,
        missionCards: { 2: 'success', 4: 'fail', 5: 'fail' },
        suspicions: { 1: { 4: 4, 5: 2 } },
      },
    ],
  }
}

describe('Replay page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state before data arrives', () => {
    vi.mocked(api.fetchGameReplay).mockReturnValueOnce(new Promise(() => {}))
    const wrapper = mount(Replay)
    expect(wrapper.text()).toContain('Loading game replay')
  })

  it('shows identity step first with all players grouped by side', async () => {
    vi.mocked(api.fetchGameReplay).mockResolvedValueOnce(makePayload())
    const wrapper = mount(Replay)
    await flushPromises()

    expect(wrapper.text()).toContain('IDENTITY REVEAL')
    expect(wrapper.text()).toContain('RESISTANCE')
    expect(wrapper.text()).toContain('SPY')
    // All five usernames render on the identity card.
    for (const name of ['Alice', 'Bob', 'Carol', 'Dan', 'Eve']) {
      expect(wrapper.text()).toContain(name)
    }
  })

  it('computes the right number of steps from the payload', async () => {
    vi.mocked(api.fetchGameReplay).mockResolvedValueOnce(makePayload())
    const wrapper = mount(Replay)
    await flushPromises()

    // identity (1) + 2 rounds × (nomination + vote + mission) (6)
    //   + 1 round w/ suspicions (1) + outcome (1) = 9
    expect(wrapper.text()).toContain('STEP 1 / 9')
  })

  it('advances through steps via NEXT button', async () => {
    vi.mocked(api.fetchGameReplay).mockResolvedValueOnce(makePayload())
    const wrapper = mount(Replay)
    await flushPromises()

    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('NEXT'))
    expect(nextBtn).toBeDefined()
    await nextBtn!.trigger('click')
    expect(wrapper.text()).toContain('NOMINATION')
    expect(wrapper.text()).toContain('STEP 2 / 9')
  })

  it('renders the outcome chip on the last step', async () => {
    vi.mocked(api.fetchGameReplay).mockResolvedValueOnce(makePayload())
    const wrapper = mount(Replay)
    await flushPromises()

    // Jump directly via tick buttons — last is the outcome step.
    const ticks = wrapper.findAll('.r-tick')
    expect(ticks.length).toBeGreaterThan(0)
    await ticks.at(-1)!.trigger('click')

    expect(wrapper.text()).toContain('RESISTANCE WINS')
    expect(wrapper.text()).toContain('MISSION VICTORY')
  })
})
