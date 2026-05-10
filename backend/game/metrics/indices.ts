/**
 * Pure math for the R/S/P-Index endpoint. Inputs are the raw `points` rows
 * (one per finished game on a given side), in chronological order (oldest
 * first). Output is a normalized weighted mean — weights sum to 1.
 */

export type WeightingStrategy =
    | { strategy: 'uniform' }
    | { strategy: 'expdecay'; alpha: number };

export interface PointsRow {
    side: 'resistance' | 'spy';
    points: number;
}

export interface IndexResult {
    rIndex: number | null;
    sIndex: number | null;
    pIndex: number | null;
    resistanceGames: number;
    spyGames: number;
}

export function computeIndices(rows: PointsRow[], weighting: WeightingStrategy): IndexResult {
    const resistance = rows.filter(r => r.side === 'resistance');
    const spy = rows.filter(r => r.side === 'spy');

    const rIndex = weightedMean(resistance.map(r => r.points), weighting);
    const sIndex = weightedMean(spy.map(r => r.points), weighting);

    let pIndex: number | null;
    if (rIndex !== null && sIndex !== null) {
        pIndex = (rIndex + sIndex) / 2;
    } else if (rIndex !== null) {
        // Whitepaper: P-Index averages the two role indices when both exist.
        // For one-sided players, surface the side that does exist instead of
        // diluting it with a 0.
        pIndex = rIndex;
    } else if (sIndex !== null) {
        pIndex = sIndex;
    } else {
        pIndex = null;
    }

    return {
        rIndex,
        sIndex,
        pIndex,
        resistanceGames: resistance.length,
        spyGames: spy.length,
    };
}

/**
 * Normalized weighted mean. `points` is in chronological order (oldest
 * first); recency weighting peaks at the last index.
 *   uniform  → 1/N for every i
 *   expdecay → weights ∝ alpha^(N-1-i), normalized so they sum to 1
 *              alpha=1 collapses to uniform; alpha→0 isolates the most recent.
 */
export function weightedMean(points: number[], weighting: WeightingStrategy): number | null {
    const N = points.length;
    if (N === 0) return null;

    if (weighting.strategy === 'uniform') {
        let sum = 0;
        for (const p of points) sum += p;
        return sum / N;
    }

    // expdecay
    const alpha = clampAlpha(weighting.alpha);
    if (alpha === 0) return points[N - 1]!;        // most-recent only
    if (alpha === 1) {
        let sum = 0;
        for (const p of points) sum += p;
        return sum / N;
    }

    // Compute α^(N-1-i) for each i, sum for normalization, then weighted sum.
    let weightSum = 0;
    let pointSum = 0;
    for (let i = 0; i < N; i++) {
        const w = Math.pow(alpha, N - 1 - i);
        weightSum += w;
        pointSum += w * points[i]!;
    }
    return pointSum / weightSum;
}

function clampAlpha(alpha: number): number {
    if (!Number.isFinite(alpha)) return 1;
    if (alpha < 0) return 0;
    if (alpha > 1) return 1;
    return alpha;
}
