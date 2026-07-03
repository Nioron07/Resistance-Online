import type * as Api from '@/services/api'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Search from '@/pages/Search.vue'
import * as api from '@/services/api'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/services/api', async orig => {
  const real = await orig<typeof Api>()
  return { ...real, searchPlayers: vi.fn(), searchGames: vi.fn() }
})

/**
 * The debounce-watcher fires with a setTimeout; advancing timers + a
 * flushPromises is enough to drive the search call without sleeping.
 */
async function flush () {
  await vi.runAllTimersAsync()
  await flushPromises()
}

describe('Search page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(api.searchPlayers).mockResolvedValue([])
    vi.mocked(api.searchGames).mockResolvedValue({ rows: [], total: 0, limit: 50, offset: 0 })
  })

  it('defaults to the PLAYER tab', () => {
    const wrapper = mount(Search)
    expect(wrapper.text()).toContain('Type a username to search.')
  })

  it('fires searchPlayers when the user types (after debounce)', async () => {
    vi.mocked(api.searchPlayers).mockResolvedValueOnce([
      { id: 1, username: 'Nioron07', pfp: null, bio: null, last_played: null },
    ])
    const wrapper = mount(Search)
    const input = wrapper.find('input[placeholder="Username"]')
    await input.setValue('nio')
    await flush()
    expect(api.searchPlayers).toHaveBeenCalledWith('nio', expect.objectContaining({ signal: expect.anything() }))
    expect(wrapper.text()).toContain('Nioron07')
  })

  it('switches to GAME tab and triggers searchGames', async () => {
    const wrapper = mount(Search)
    const tabs = wrapper.findAll('button.r-tab')
    const gameTab = tabs.find(t => t.text() === 'GAME')!
    await gameTab.trigger('click')
    await flush()
    expect(api.searchGames).toHaveBeenCalled()
    // First call had no filters set.
    expect(vi.mocked(api.searchGames).mock.calls[0]![0]).toEqual({
      q: undefined,
      before: undefined,
      after: undefined,
      winner: undefined,
      outcomeType: undefined,
      minPlayers: undefined,
      maxPlayers: undefined,
    })
  })

  it('sends winner=spy when the SPY pill is clicked', async () => {
    const wrapper = mount(Search)
    const tabs = wrapper.findAll('button.r-tab')
    await tabs.find(t => t.text() === 'GAME')!.trigger('click')
    await flush()
    vi.mocked(api.searchGames).mockClear()

    const pills = wrapper.findAll('button.r-pill')
    const spyPill = pills.find(p => p.text() === 'SPY')!
    await spyPill.trigger('click')
    await flush()

    expect(api.searchGames).toHaveBeenCalled()
    const lastCall = vi.mocked(api.searchGames).mock.calls.at(-1)![0]
    expect(lastCall.winner).toBe('spy')
  })
})
