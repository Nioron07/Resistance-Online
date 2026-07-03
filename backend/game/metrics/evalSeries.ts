import type { MetricsRow } from '../../routes/api/users/_userid/metrics/index.js';
import { SPY_ROLES } from '../../routes/api/users/_userid/metrics/index.js';
import { scoreRowForPlayer, type Side } from './points.js';

/**
 * Eval-bar time series from the whitepaper's "Throw" section: a running
 * per-round team point differential, like chess.com's evaluation bar.
 *
 * For each round we score every player with the per-round point engine
 * (no end-of-game bonus — the bar tracks the trajectory, not the result)
 * and accumulate per-team totals. `differential` is cumulative
 * resistance − spy points after the round resolves: positive = resistance
 * ahead, negative = spies ahead.
 */
export interface EvalPoint {
    /** voting_rounds.id — aligns the point with the replay round. */
    roundId: number;
    /** Team points earned in this round alone. */
    resistanceDelta: number;
    spyDelta: number;
    /** Cumulative resistance − spy points after this round. */
    differential: number;
}

export function computeEvalSeries(rows: MetricsRow[]): EvalPoint[] {
    if (rows.length === 0) return [];

    const players = rows[0]!.players;
    const sides: Array<[string, Side]> = [];
    for (const [userid, role] of Object.entries(players)) {
        if (role === null) continue;
        sides.push([userid, SPY_ROLES.has(role) ? 'spy' : 'resistance']);
    }

    const series: EvalPoint[] = [];
    let cumulative = 0;

    for (const row of rows) {
        let resistanceDelta = 0;
        let spyDelta = 0;
        for (const [userid, side] of sides) {
            const delta = scoreRowForPlayer(side, userid, row);
            if (side === 'resistance') resistanceDelta += delta;
            else                       spyDelta += delta;
        }
        cumulative += resistanceDelta - spyDelta;
        series.push({
            roundId: Number(row.round_id),
            resistanceDelta,
            spyDelta,
            differential: cumulative,
        });
    }

    return series;
}
