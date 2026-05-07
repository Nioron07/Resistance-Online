import { describe, expect, it } from 'vitest'
import { useGameStore } from '@/stores/game'
import { seedGameStore } from './helpers'

describe('Game Store', () => {
  it('starts empty before any state is applied', () => {
    const game = useGameStore()
    expect(game.playerIds).toEqual([])
    expect(game.playerCount).toBe(0)
  })

  it('playerCount tracks playerIds.length', () => {
    const game = seedGameStore({ playerIds: [10, 20, 30, 40, 50] })
    expect(game.playerCount).toBe(5)
    expect(game.playerCount).toBe(game.playerIds.length)
  })

  it('isHost is true for the first player in playerIds', () => {
    const game = seedGameStore({ myId: 7, playerIds: [7, 8, 9, 10, 11] })
    expect(game.isHost).toBe(true)
  })

  it('isHost is false for non-first players', () => {
    const game = seedGameStore({ myId: 8, playerIds: [7, 8, 9, 10, 11] })
    expect(game.isHost).toBe(false)
  })

  it('amLeader follows leaderId', () => {
    const game = seedGameStore({ myId: 1, playerIds: [1, 2, 3, 4, 5] })
    expect(game.amLeader).toBe(true)
    game.leaderId = 2
    expect(game.amLeader).toBe(false)
  })

  it('currTeamSize tracks the current mission rules (5 players, mission 0 → 2)', () => {
    const game = seedGameStore({ playerIds: [1, 2, 3, 4, 5], mission: 0 })
    expect(game.currTeamSize).toBe(2)
    game.mission = 1
    expect(game.currTeamSize).toBe(3)
  })

  it('numSpies and numResistance follow rules table', () => {
    const game = seedGameStore({ playerIds: [1, 2, 3, 4, 5, 6, 7] })
    // 7-player game has 3 spies and 4 resistance.
    expect(game.numSpies).toBe(3)
    expect(game.numResistance).toBe(4)
  })

  it('returns a background image', () => {
    const game = seedGameStore({ playerIds: [1, 2, 3, 4, 5] })
    expect(game.backgroundImage).toBeTruthy()
  })
})
