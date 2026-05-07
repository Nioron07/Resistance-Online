// AI generated test cases for the game store
import { describe, expect, it } from 'vitest'
import { useGameStore } from '@/stores/game'

describe('Game Store', () => {
  it('has initial players', () => {
    const game = useGameStore()
    expect(game.players.length).toBeGreaterThan(0)
  })

  it('computes playerCount from players array', () => {
    const game = useGameStore()
    expect(game.playerCount).toBe(game.players.length)
  })

  it('computes startingLeader as first player', () => {
    const game = useGameStore()
    expect(game.startingLeader).toBe(game.players[0])
  })

  it('updates startingLeader when players are reordered', () => {
    const game = useGameStore()
    const original = game.players[0]
    const second = game.players[1]
    game.players = [second, original, ...game.players.slice(2)]
    expect(game.startingLeader).toBe(second)
  })

  it('returns a background image', () => {
    const game = useGameStore()
    expect(game.backgroundImage).toBeTruthy()
  })
})
