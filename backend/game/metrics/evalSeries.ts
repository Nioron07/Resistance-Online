import type { MetricsRow } from '../../routes/api/users/_userid/metrics/index.js';
import { SPY_ROLES } from '../../routes/api/users/_userid/metrics/index.js';
import { scoreRowBreakdownForPlayer, type Side } from './points.js';
import type { ActionKey } from './actionPoints.js';

/**
 * Eval-bar time series from the whitepaper's "Throw" section: a running
 * per-round team point differential, like chess.com's evaluation bar.
 *
 * For each round we score every player with the per-round point engine
 * (no end-of-game bonus — the bar tracks the trajectory, not the result)
 * and accumulate per-team totals. `differential` is cumulative
 * resistance − spy points after the round resolves: positive = resistance
 * ahead, negative = spies ahead.
 *
 * Each point also splits its round's contribution into the four replay
 * phases so the bar can advance step by step within a round, not just
 * once per round. Every catalog action belongs to exactly one phase.
 */

export type RoundPhase = 'nomination' | 'vote' | 'mission' | 'suspicion';

export const PHASE_ORDER: readonly RoundPhase[] = ['nomination', 'vote', 'mission', 'suspicion'];

/**
 * Which replay step each scored action "happens" at:
 *  - nomination: proposing the team (leadership base)
 *  - vote:       the ballots (plus the leader's approved-dirty bonus,
 *                which is decided by the vote result)
 *  - mission:    everything gated on the mission running/outcome —
 *                the vote-outcome bonuses, team participation, cards
 *  - suspicion:  active + passive suspicion records
 * game_won/game_lost never appear in per-round breakdowns.
 */
const ACTION_PHASE: Record<ActionKey, RoundPhase> = {
    led_clean_team:                    'nomination',
    led_dirty_team:                    'nomination',

    approve_clean_team:                'vote',
    approve_dirty_team:                'vote',
    reject_clean_team:                 'vote',
    reject_dirty_team:                 'vote',
    led_dirty_team_approved:           'vote',

    approved_clean_succeeded:          'mission',
    approved_dirty_failed:             'mission',
    approved_clean_failed:             'mission',
    approved_dirty_succeeded:          'mission',
    on_team_mission_succeeded:         'mission',
    on_team_mission_failed:            'mission',
    played_fail_card:                  'mission',
    played_success_when_failed:        'mission',

    suspicion_correct_per_gamma:       'suspicion',
    suspicion_incorrect_per_gamma:     'suspicion',
    trusted_by_resistance_per_voter:   'suspicion',
    suspected_by_resistance_per_gamma: 'suspicion',

    game_won:                          'suspicion', // unreachable per-round; keys kept for exhaustiveness
    game_lost:                         'suspicion',
};

export interface EvalPoint {
    /** voting_rounds.id — aligns the point with the replay round. */
    roundId: number;
    /** Team points earned in this round alone. */
    resistanceDelta: number;
    spyDelta: number;
    /** Cumulative resistance − spy points after this round. */
    differential: number;
    /**
     * This round's differential contribution (resistance − spy) split by
     * phase. Sums to resistanceDelta − spyDelta.
     */
    phaseDeltas: Record<RoundPhase, number>;
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
        const phaseDeltas: Record<RoundPhase, number> = {
            nomination: 0, vote: 0, mission: 0, suspicion: 0,
        };

        for (const [userid, side] of sides) {
            const breakdown = scoreRowBreakdownForPlayer(side, userid, row);
            const sign = side === 'resistance' ? 1 : -1;
            for (const [key, value] of Object.entries(breakdown)) {
                if (side === 'resistance') resistanceDelta += value;
                else                       spyDelta += value;
                const phase = ACTION_PHASE[key as ActionKey] ?? 'suspicion';
                phaseDeltas[phase] += sign * value;
            }
        }

        cumulative += resistanceDelta - spyDelta;
        series.push({
            roundId: Number(row.round_id),
            resistanceDelta,
            spyDelta,
            differential: cumulative,
            phaseDeltas,
        });
    }

    return series;
}
