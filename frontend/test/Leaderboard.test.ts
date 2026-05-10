import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Leaderboard from '@/pages/Leaderboard.vue'
import * as api from '@/services/api'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/services/api', async orig => {
  const real = await orig<typeof api>()
  return { ...real, fetchLeaderboard: vi.fn() }
})

describe('Leaderboard page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads pIndex by default and renders the rows', async () => {
    vi.mocked(api.fetchLeaderboard).mockResolvedValueOnce({
      metric: 'pIndex',
      weighting: { strategy: 'expdecay', alpha: 0.95 },
      rows: [
        { rank: 1, userid: 1, username: 'one', pfp: null, value: 6.3, games: 14 },
        { rank: 2, userid: 2, username: 'two', pfp: null, value: 4.5, games: 10 },
        { rank: 3, userid: 3, username: 'three', pfp: null, value: 2.1, games: 7 },
      ],
    })
    const w = mount(Leaderboard)
    await flushPromises()
    expect(api.fetchLeaderboard).toHaveBeenCalledWith('pIndex', 50)
    expect(w.text()).toContain('one')
    expect(w.text()).toContain('two')
    expect(w.text()).toContain('three')
    expect(w.text()).toContain('6.30')
  })

  it('switches metric when a tab is clicked', async () => {
    vi.mocked(api.fetchLeaderboard)
      .mockResolvedValueOnce({ metric: 'pIndex', weighting: { strategy: 'expdecay', alpha: 0.95 }, rows: [] })
      .mockResolvedValueOnce({ metric: 'lifetimePoints', weighting: { strategy: 'expdecay', alpha: 0.95 }, rows: [
        { rank: 1, userid: 1, username: 'pts-leader', pfp: null, value: 99, games: 30 },
      ] })

    const w = mount(Leaderboard)
    await flushPromises()

    const tabs = w.findAll('.r-tab')
    const ptsTab = tabs.find(t => t.text() === 'LIFETIME PTS')!
    await ptsTab.trigger('click')
    await flushPromises()

    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('lifetimePoints', 50)
    expect(w.text()).toContain('pts-leader')
    expect(w.text()).toContain('99')
  })

  it('renders the empty-state when the API returns no rows', async () => {
    vi.mocked(api.fetchLeaderboard).mockResolvedValueOnce({
      metric: 'pIndex', weighting: { strategy: 'expdecay', alpha: 0.95 }, rows: [],
    })
    const w = mount(Leaderboard)
    await flushPromises()
    expect(w.text()).toContain('Not enough games yet')
  })

  it('formats lifetimePoints as integers (no decimals)', async () => {
    vi.mocked(api.fetchLeaderboard)
      .mockResolvedValueOnce({ metric: 'pIndex', weighting: { strategy: 'expdecay', alpha: 0.95 }, rows: [] })
      .mockResolvedValueOnce({ metric: 'lifetimePoints', weighting: { strategy: 'expdecay', alpha: 0.95 }, rows: [
        { rank: 1, userid: 1, username: 'a', pfp: null, value: 42, games: 5 },
      ] })
    const w = mount(Leaderboard)
    await flushPromises()
    const ptsTab = w.findAll('.r-tab').find(t => t.text() === 'LIFETIME PTS')!
    await ptsTab.trigger('click')
    await flushPromises()
    // Lifetime values render as plain integers — no '.00' suffix.
    expect(w.text()).toContain('42')
    expect(w.text()).not.toContain('42.00')
  })
})
