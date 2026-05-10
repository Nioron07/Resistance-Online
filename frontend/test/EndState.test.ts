import type * as Api from '@/services/api'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EndState from '@/pages/Game/[GameID]/EndState.vue'
import * as api from '@/services/api'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { GameID: '42' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/api', async orig => {
  const real = await orig<typeof Api>()
  return { ...real, fetchGameMetrics: vi.fn() }
})

function makePayload (winner: 'resistance' | 'spies' | null): api.GameMetrics {
  return {
    gameid: 42,
    endTimestamp: '2026-05-06T12:00:00Z',
    outcome: {
      winner,
      outcomeType: 'mission-victory',
      missionStatuses: [true, false, true, true, true],
      countFailedVotes: 1,
    },
    teams: {
      resistance: {
        totalPoints: 16,
        players: [
          {
            userid: 1, username: 'one', pfp: null, role: 'resistance', side: 'resistance',
            points: 8, breakdown: { approve_clean_team: 1, game_won: 5 },
            catalogVersion: '2',
            complexMetric: { key: 'RoS_G', value: 0.5 },
            indexBefore: { rIndex: 4, sIndex: null, pIndex: 4 },
            indexAfter: { rIndex: 6, sIndex: null, pIndex: 6 },
            indexDelta: { rIndex: 2, sIndex: null, pIndex: 2 },
          },
        ],
      },
      spy: {
        totalPoints: -11,
        players: [
          {
            userid: 4, username: 'four', pfp: null, role: 'spy', side: 'spy',
            points: -5, breakdown: { reject_dirty_team: -3, game_lost: -5 },
            catalogVersion: '2',
            complexMetric: { key: 'RoI_G', value: 0.3 },
            indexBefore: { rIndex: null, sIndex: 2, pIndex: 2 },
            indexAfter: { rIndex: null, sIndex: 0, pIndex: 0 },
            indexDelta: { rIndex: null, sIndex: -2, pIndex: -2 },
          },
        ],
      },
    },
    details: {
      weighting: { strategy: 'expdecay', alpha: 0.95 },
      catalogVersion: '2',
    },
  }
}

describe('EndState page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the resistance-win headline + reason', async () => {
    vi.mocked(api.fetchGameMetrics).mockResolvedValueOnce(makePayload('resistance'))
    const wrapper = mount(EndState)
    await flushPromises()
    expect(wrapper.text()).toContain('RESISTANCE WINS')
    expect(wrapper.text()).toContain('MISSION VICTORY')
  })

  it('renders the spies-win headline', async () => {
    vi.mocked(api.fetchGameMetrics).mockResolvedValueOnce(makePayload('spies'))
    const wrapper = mount(EndState)
    await flushPromises()
    expect(wrapper.text()).toContain('SPIES WIN')
  })

  it('renders a row per player on each side with correct totals', async () => {
    vi.mocked(api.fetchGameMetrics).mockResolvedValueOnce(makePayload('resistance'))
    const wrapper = mount(EndState)
    await flushPromises()
    // Username + role appear in each table
    expect(wrapper.text()).toContain('one')
    expect(wrapper.text()).toContain('four')
    // Team totals visible
    expect(wrapper.text()).toContain('R · 16')
    expect(wrapper.text()).toContain('S · -11')
  })

  it('shows the catalog badge', async () => {
    vi.mocked(api.fetchGameMetrics).mockResolvedValueOnce(makePayload('resistance'))
    const wrapper = mount(EndState)
    await flushPromises()
    expect(wrapper.text()).toContain('CATALOG v2')
  })

  it('falls back when winner is null', async () => {
    vi.mocked(api.fetchGameMetrics).mockResolvedValueOnce(makePayload(null))
    const wrapper = mount(EndState)
    await flushPromises()
    expect(wrapper.text()).toContain('IN PROGRESS')
  })
})
