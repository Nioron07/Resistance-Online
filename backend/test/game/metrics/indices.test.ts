import { describe, it, expect } from 'vitest';
import { computeIndices, weightedMean } from '../../../game/metrics/indices.js';
import type { PointsRow } from '../../../game/metrics/indices.js';

describe('weightedMean', () => {
    it('returns null for an empty array', () => {
        expect(weightedMean([], { strategy: 'uniform' })).toBe(null);
        expect(weightedMean([], { strategy: 'expdecay', alpha: 0.95 })).toBe(null);
    });

    it('uniform is the arithmetic mean', () => {
        expect(weightedMean([2, 4, 6], { strategy: 'uniform' })).toBe(4);
    });

    it('expdecay with alpha=1 collapses to uniform', () => {
        expect(weightedMean([2, 4, 6], { strategy: 'expdecay', alpha: 1 })).toBe(4);
    });

    it('expdecay with alpha=0 isolates the most recent', () => {
        expect(weightedMean([2, 4, 6], { strategy: 'expdecay', alpha: 0 })).toBe(6);
    });

    it('expdecay with 0 < alpha < 1 weights recent games more', () => {
        // Two games, points [10, 0]. Uniform mean is 5. With alpha=0.5,
        // weights are α^1=0.5 (oldest) and α^0=1 (newest), normalized to
        // 1/3 and 2/3 → result = 10/3 ≈ 3.333.
        const got = weightedMean([10, 0], { strategy: 'expdecay', alpha: 0.5 })!;
        expect(got).toBeCloseTo(10 / 3, 6);
    });

    it('clamps alpha out of range', () => {
        expect(weightedMean([1, 2, 3], { strategy: 'expdecay', alpha: 5 })).toBe(2);   // → uniform
        expect(weightedMean([1, 2, 3], { strategy: 'expdecay', alpha: -1 })).toBe(3);  // → most recent
    });
});

describe('computeIndices', () => {
    function r(points: number): PointsRow { return { side: 'resistance', points }; }
    function s(points: number): PointsRow { return { side: 'spy', points }; }

    it('returns nulls for an empty input', () => {
        const got = computeIndices([], { strategy: 'uniform' });
        expect(got).toEqual({ rIndex: null, sIndex: null, pIndex: null, resistanceGames: 0, spyGames: 0 });
    });

    it('uniform: P-Index is the arithmetic mean of (R, S)', () => {
        const got = computeIndices([r(4), r(8), s(12)], { strategy: 'uniform' });
        expect(got.rIndex).toBe(6);
        expect(got.sIndex).toBe(12);
        expect(got.pIndex).toBe(9);
        expect(got.resistanceGames).toBe(2);
        expect(got.spyGames).toBe(1);
    });

    it('one-sided player: P-Index equals the side that exists (no dilution)', () => {
        const got = computeIndices([r(5), r(7)], { strategy: 'uniform' });
        expect(got.rIndex).toBe(6);
        expect(got.sIndex).toBe(null);
        expect(got.pIndex).toBe(6);
    });

    it('uniform R-Index is invariant under shuffling within a side', () => {
        const a = computeIndices([r(1), r(2), r(3), r(4)], { strategy: 'uniform' });
        const b = computeIndices([r(4), r(2), r(1), r(3)], { strategy: 'uniform' });
        expect(a.rIndex).toBe(b.rIndex);
    });

    it('expdecay weights chronological order — more-recent games dominate', () => {
        const old = computeIndices([r(0), r(0), r(10)], { strategy: 'expdecay', alpha: 0.5 });
        const recent = computeIndices([r(10), r(0), r(0)], { strategy: 'expdecay', alpha: 0.5 });
        expect(old.rIndex!).toBeGreaterThan(recent.rIndex!);
    });
});
