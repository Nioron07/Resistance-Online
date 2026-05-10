import { describe, it, expect } from 'vitest';
import { computeRoS_G, computeRoI_G } from '../../../game/metrics/perGameComplex.js';
import type { MetricsRow } from '../../../routes/api/users/_userid/metrics/index.js';

const PLAYERS_5: Record<string, string | null> = {
    '1': 'resistance', '2': 'resistance', '3': 'resistance',
    '4': 'spy', '5': 'spy',
};

function row(o: Partial<MetricsRow>): MetricsRow {
    return {
        game_id: 1,
        round_id: 0,
        leader_userid: '1',
        mission_participent_userids: null,
        count_spies_nominated: null,
        vote_status: null,
        mission_status: null,
        suspicions: null,
        players: PLAYERS_5,
        resistance_win: true,
        round_index_in_game: 0,
        ...o,
    };
}

describe('computeRoS_G', () => {
    it('returns null for a spy', () => {
        expect(computeRoS_G('4', [row({ suspicions: { '4': { '5': 5 } } })])).toBe(null);
    });

    it('returns null when the resistance player never voted', () => {
        expect(computeRoS_G('1', [row({})])).toBe(null);
    });

    it('perfect spy detection at γ=5 across one round → 0.5 (matches whitepaper formula)', () => {
        // 1 round, |V|=2 votes both correct at γ=5, spyCount=2, c·γ summed = 10
        // RoS_G = 10 / (5 × 2 × 1) = 1.0
        const r = computeRoS_G('1', [row({
            suspicions: { '1': { '4': 5, '5': 5 } },
        })]);
        expect(r).toBe(1.0);
    });

    it('penalizes wrong picks: 1 right at γ=5 + 1 wrong at γ=5 → 0', () => {
        const r = computeRoS_G('1', [row({
            suspicions: { '1': { '4': 5, '2': 5 } },        // spy then resistance
        })]);
        expect(r).toBe(0);
    });

    it('clamps γ defensively', () => {
        const r = computeRoS_G('1', [row({
            suspicions: { '1': { '4': 999 } },
        })]);
        // After clamp: γ=5 → sum=5, RoS_G = 5 / (5 × 2 × 1) = 0.5
        expect(r).toBe(0.5);
    });
});

describe('computeRoI_G', () => {
    it('returns null for a resistance player', () => {
        expect(computeRoI_G('1', [row({ suspicions: { '1': { '4': 5 } } })])).toBe(null);
    });

    it('returns 1.0 when nobody marked the spy at all', () => {
        // Resistance picks fall on player 5, spy 4 unmarked.
        const r = computeRoI_G('4', [row({
            suspicions: { '1': { '5': 5 }, '2': { '5': 5 } },
        })]);
        // |R| = 2 votes, both for 5; sum_for_4 = 0 → 1 - (2/(5×2)) × 0 = 1
        expect(r).toBe(1);
    });

    it('drops as the spy gets marked at higher confidence', () => {
        // |R|=2 (only counts non-zero votes after clamp), userWeightedSum (γ for spy 4) = 5+5=10
        // RoI_G = 1 - (2/(5×2)) × 10 = 1 - 2 = -1
        const heavy = computeRoI_G('4', [row({
            suspicions: { '1': { '4': 5 }, '2': { '4': 5 } },
        })]);
        // |R|=2, userWeightedSum=2 → 1 - (2/(5×2)) × 2 = 1 - 0.4 = 0.6
        const light = computeRoI_G('4', [row({
            suspicions: { '1': { '4': 1 }, '2': { '4': 1 } },
        })]);
        expect(heavy!).toBeLessThan(light!);
        expect(light).toBeCloseTo(0.6, 6);
    });

    it('returns null when there were no suspicion records at all', () => {
        expect(computeRoI_G('4', [row({})])).toBe(null);
    });
});
