import { describe, it, expect } from 'vitest';
import { computeEvalSeries } from '../../../game/metrics/evalSeries.js';
import { computeGamePoints, scoreRowForPlayer } from '../../../game/metrics/points.js';
import {
    RESISTANCE_ACTION_POINTS,
    SPY_ACTION_POINTS,
} from '../../../game/metrics/actionPoints.js';
import type { MetricsRow } from '../../../routes/api/users/_userid/metrics/index.js';

const PLAYERS: Record<string, string | null> = {
    '1': 'resistance',
    '2': 'resistance',
    '3': 'resistance',
    '4': 'spy',
    '5': 'spy',
};

function row(overrides: Partial<MetricsRow>): MetricsRow {
    return {
        game_id: 1,
        round_id: 0,
        leader_userid: null,
        mission_participent_userids: null,
        count_spies_nominated: null,
        vote_status: null,
        mission_status: null,
        suspicions: null,
        players: PLAYERS,
        resistance_win: true,
        round_index_in_game: 0,
        vote_poll: null,
        mission_cards: null,
        ...overrides,
    };
}

describe('computeEvalSeries', () => {
    it('returns [] for no rounds', () => {
        expect(computeEvalSeries([])).toEqual([]);
    });

    it('produces one point per round, aligned by roundId', () => {
        const rows = [row({ round_id: 11 }), row({ round_id: 12 })];
        const series = computeEvalSeries(rows);
        expect(series.map(p => p.roundId)).toEqual([11, 12]);
    });

    it('an information-free round contributes zero to both teams', () => {
        const [p] = computeEvalSeries([row({})]);
        expect(p!.resistanceDelta).toBe(0);
        expect(p!.spyDelta).toBe(0);
        expect(p!.differential).toBe(0);
    });

    it('accumulates team deltas into a running differential', () => {
        // Round 1: all resistance approve a clean team (spies didn't vote).
        const r1 = row({
            round_id: 1,
            count_spies_nominated: 0,
            vote_poll: { '1': true, '2': true, '3': true },
        });
        // Round 2: both spies approve a dirty team.
        const r2 = row({
            round_id: 2,
            count_spies_nominated: 1,
            vote_poll: { '4': true, '5': true },
        });
        const series = computeEvalSeries([r1, r2]);

        const rApprove = RESISTANCE_ACTION_POINTS.approve_clean_team * 3;
        const sApprove = SPY_ACTION_POINTS.approve_dirty_team * 2;

        expect(series[0]!.resistanceDelta).toBeCloseTo(rApprove);
        expect(series[0]!.spyDelta).toBe(0);
        expect(series[0]!.differential).toBeCloseTo(rApprove);

        expect(series[1]!.resistanceDelta).toBe(0);
        expect(series[1]!.spyDelta).toBeCloseTo(sApprove);
        expect(series[1]!.differential).toBeCloseTo(rApprove - sApprove);
    });

    it('phaseDeltas sum to the round differential and land on the right phases', () => {
        const r = row({
            round_id: 1,
            leader_userid: '1',                                  // resistance leads clean team → nomination
            count_spies_nominated: 0,
            mission_participent_userids: ['1', '2'],
            vote_status: true,
            mission_status: true,
            vote_poll: { '1': true, '2': true, '3': true, '4': false, '5': false },  // vote
            mission_cards: { '1': 'success', '2': 'success' },   // mission
            suspicions: { '3': { '4': 2 } },                     // suspicion
        });
        const [p] = computeEvalSeries([r]);

        // Every phase used by this round contributes something…
        expect(p!.phaseDeltas.nomination).toBeCloseTo(RESISTANCE_ACTION_POINTS.led_clean_team);
        expect(p!.phaseDeltas.vote).not.toBe(0);
        expect(p!.phaseDeltas.mission).not.toBe(0);
        expect(p!.phaseDeltas.suspicion).not.toBe(0);

        // …and the phases exactly reconstruct the round's differential.
        const phaseSum = p!.phaseDeltas.nomination + p!.phaseDeltas.vote
            + p!.phaseDeltas.mission + p!.phaseDeltas.suspicion;
        expect(phaseSum).toBeCloseTo(p!.resistanceDelta - p!.spyDelta);
        expect(phaseSum).toBeCloseTo(p!.differential);
    });

    it('a rejected round has zero mission-phase delta', () => {
        const r = row({
            round_id: 1,
            leader_userid: '4',
            count_spies_nominated: 1,
            mission_participent_userids: ['4', '1'],
            vote_status: false,
            mission_status: null,
            vote_poll: { '1': false, '2': false, '3': false, '4': true, '5': true },
        });
        const [p] = computeEvalSeries([r]);
        expect(p!.phaseDeltas.mission).toBe(0);
    });

    it('summed per-round deltas + outcome bonus reproduce computeGamePoints', () => {
        const rows = [
            row({
                round_id: 1,
                leader_userid: '1',
                count_spies_nominated: 0,
                mission_participent_userids: ['1', '2'],
                vote_status: true,
                mission_status: true,
                vote_poll: { '1': true, '2': true, '3': true, '4': false, '5': false },
                mission_cards: { '1': 'success', '2': 'success' },
            }),
            row({
                round_id: 2,
                leader_userid: '2',
                count_spies_nominated: 1,
                mission_participent_userids: ['2', '4'],
                vote_status: true,
                mission_status: false,
                vote_poll: { '1': false, '2': true, '3': true, '4': true, '5': true },
                mission_cards: { '2': 'success', '4': 'fail' },
                suspicions: { '1': { '4': 3, '5': 1 }, '3': { '2': 2 } },
            }),
        ];

        const perRoundSum = rows.reduce((acc, r) => acc + scoreRowForPlayer('resistance', '1', r), 0);
        const full = computeGamePoints('1', rows)!;
        const outcomeBonus = RESISTANCE_ACTION_POINTS.game_won;

        expect(perRoundSum + outcomeBonus).toBeCloseTo(full.points);
    });
});
