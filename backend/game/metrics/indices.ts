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

export interface HistoryInputRow extends PointsRow {
    gameid: number;
    endTimestamp: string;
}

export interface IndexHistoryPoint {
    gameid: number;
    endTimestamp: string;
    side: 'resistance' | 'spy';
    /** Points earned in this game. */
    points: number;
    /** Indices as of (and including) this game. */
    rIndex: number | null;
    sIndex: number | null;
    pIndex: number | null;
}

/**
 * Per-game index trajectory: for each game (chronological), the R/S/P
 * indices computed over every game up to and including it — i.e. what the
 * player's rating chart looks like over time.
 *
 * Computed incrementally in O(N): for expdecay the prefix weighted mean
 * satisfies sumW ← α·sumW + 1, sumP ← α·sumP + p, mean = sumP/sumW, which
 * is exactly weightedMean() on the prefix.
 */
export function computeIndexHistory(rows: HistoryInputRow[], weighting: WeightingStrategy): IndexHistoryPoint[] {
    const alpha = weighting.strategy === 'expdecay' ? clampAlpha(weighting.alpha) : 1;

    // Running per-side accumulators. alpha === 1 (or uniform) degenerates
    // to a plain mean; alpha === 0 to "most recent game only".
    const acc = {
        resistance: { sumW: 0, sumP: 0, mean: null as number | null },
        spy:        { sumW: 0, sumP: 0, mean: null as number | null },
    };

    const history: IndexHistoryPoint[] = [];
    for (const row of rows) {
        const a = acc[row.side];
        if (alpha === 0) {
            a.mean = row.points;
        } else {
            a.sumW = alpha * a.sumW + 1;
            a.sumP = alpha * a.sumP + row.points;
            a.mean = a.sumP / a.sumW;
        }

        const rIndex = acc.resistance.mean;
        const sIndex = acc.spy.mean;
        // Same one-sided fallback as computeIndices.
        const pIndex = rIndex !== null && sIndex !== null
            ? (rIndex + sIndex) / 2
            : rIndex ?? sIndex;

        history.push({
            gameid: row.gameid,
            endTimestamp: row.endTimestamp,
            side: row.side,
            points: row.points,
            rIndex,
            sIndex,
            pIndex,
        });
    }
    return history;
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
