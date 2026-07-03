import { describe, it, expect } from 'vitest';
import { computeGamePoints } from '../../../game/metrics/points.js';
import {
    CATALOG_VERSION,
    RESISTANCE_ACTION_POINTS,
    SPY_ACTION_POINTS,
} from '../../../game/metrics/actionPoints.js';
import type { MetricsRow } from '../../../routes/api/users/_userid/metrics/index.js';

const RESISTANCE_PLAYERS: Record<string, string | null> = {
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
        leader_userid: '1',
        mission_participent_userids: null,
        count_spies_nominated: null,
        vote_status: null,
        mission_status: null,
        suspicions: null,
        players: RESISTANCE_PLAYERS,
        resistance_win: true,
        round_index_in_game: 0,
        vote_poll: null,
        mission_cards: null,
        ...overrides,
    };
}

describe('computeGamePoints — gating', () => {
    it('returns null when the user did not play in the game', () => {
        expect(computeGamePoints('999', [row({})])).toBe(null);
    });

    it('returns null for an unfinished game (resistance_win === null)', () => {
        expect(computeGamePoints('1', [row({ resistance_win: null })])).toBe(null);
    });

    it('breakdown sums to points', () => {
        const rows = [
            row({
                vote_status: true,
                mission_status: true,
                count_spies_nominated: 0,
                mission_participent_userids: ['1', '2'],
                vote_poll: { '1': true, '2': true, '3': true, '4': false, '5': false },
                mission_cards: { '1': 'success', '2': 'success' },
                suspicions: { '3': { '4': 4 } },
            }),
        ];
        const result = computeGamePoints('1', rows)!;
        const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
        expect(result.points).toBe(sum);
        expect(result.catalogVersion).toBe(CATALOG_VERSION);
    });

    it('side is detected from the players JSONB', () => {
        expect(computeGamePoints('1', [row({})])!.side).toBe('resistance');
        expect(computeGamePoints('4', [row({})])!.side).toBe('spy');
    });
});

describe('computeGamePoints — voting + outcome bonus (resistance)', () => {
    it('approve a clean team that succeeded fires base + bonus', () => {
        const r = computeGamePoints('3', [row({
            vote_status: true,
            mission_status: true,
            count_spies_nominated: 0,
            mission_participent_userids: ['1', '2'],
            vote_poll: { '3': true },
        })])!;
        expect(r.breakdown.approve_clean_team).toBe(RESISTANCE_ACTION_POINTS.approve_clean_team);
        expect(r.breakdown.approved_clean_succeeded).toBe(RESISTANCE_ACTION_POINTS.approved_clean_succeeded);
    });

    it('approve a dirty team that failed fires base + bonus', () => {
        const r = computeGamePoints('3', [row({
            vote_status: true,
            mission_status: false,
            count_spies_nominated: 1,
            mission_participent_userids: ['1', '4'],
            vote_poll: { '3': true },
        })])!;
        expect(r.breakdown.approve_dirty_team).toBe(RESISTANCE_ACTION_POINTS.approve_dirty_team);
        expect(r.breakdown.approved_dirty_failed).toBe(RESISTANCE_ACTION_POINTS.approved_dirty_failed);
    });

    it('reject a dirty team fires base only (no outcome bonus when rejected)', () => {
        const r = computeGamePoints('3', [row({
            vote_status: false,
            count_spies_nominated: 1,
            mission_participent_userids: ['1', '4'],
            vote_poll: { '3': false },
        })])!;
        expect(r.breakdown.reject_dirty_team).toBe(RESISTANCE_ACTION_POINTS.reject_dirty_team);
        expect(r.breakdown.approved_dirty_failed).toBeUndefined();
    });

    it('reject a clean team penalizes (paranoia)', () => {
        const r = computeGamePoints('3', [row({
            vote_status: false,
            count_spies_nominated: 0,
            mission_participent_userids: ['1', '2'],
            vote_poll: { '3': false },
        })])!;
        expect(r.breakdown.reject_clean_team).toBe(RESISTANCE_ACTION_POINTS.reject_clean_team);
    });
});

describe('computeGamePoints — voting (spy)', () => {
    it('user example: spy rejecting a dirty team takes a hit', () => {
        const r = computeGamePoints('4', [row({
            vote_status: false,
            count_spies_nominated: 1,
            mission_participent_userids: ['1', '4'],
            vote_poll: { '4': false },
            resistance_win: false,
        })])!;
        expect(r.side).toBe('spy');
        expect(r.breakdown.reject_dirty_team).toBe(SPY_ACTION_POINTS.reject_dirty_team);
    });

    it('spy rejecting a clean team rewards (sowing mistrust)', () => {
        const r = computeGamePoints('4', [row({
            vote_status: false,
            count_spies_nominated: 0,
            vote_poll: { '4': false },
            resistance_win: false,
        })])!;
        expect(r.breakdown.reject_clean_team).toBe(SPY_ACTION_POINTS.reject_clean_team);
    });

    it('spy approving a dirty team that failed fires base + bonus', () => {
        const r = computeGamePoints('4', [row({
            vote_status: true,
            mission_status: false,
            count_spies_nominated: 1,
            mission_participent_userids: ['1', '4'],
            vote_poll: { '4': true },
            resistance_win: false,
        })])!;
        expect(r.breakdown.approve_dirty_team).toBe(SPY_ACTION_POINTS.approve_dirty_team);
        expect(r.breakdown.approved_dirty_failed).toBe(SPY_ACTION_POINTS.approved_dirty_failed);
    });
});

describe('computeGamePoints — team participation', () => {
    it('spy on a failed mission team scores on_team_mission_failed + played_fail_card', () => {
        const r = computeGamePoints('4', [row({
            vote_status: true,
            mission_status: false,
            count_spies_nominated: 1,
            mission_participent_userids: ['1', '4'],
            vote_poll: { '4': true },
            mission_cards: { '1': 'success', '4': 'fail' },
            resistance_win: false,
        })])!;
        expect(r.breakdown.on_team_mission_failed).toBe(SPY_ACTION_POINTS.on_team_mission_failed);
        expect(r.breakdown.played_fail_card).toBe(SPY_ACTION_POINTS.played_fail_card);
    });

    it('spy on a failed mission who played success takes the hide-behind penalty', () => {
        const r = computeGamePoints('4', [row({
            vote_status: true,
            mission_status: false,
            count_spies_nominated: 2,
            mission_participent_userids: ['4', '5'],
            vote_poll: { '4': true },
            mission_cards: { '4': 'success', '5': 'fail' },
            resistance_win: false,
        })])!;
        expect(r.breakdown.played_success_when_failed).toBe(SPY_ACTION_POINTS.played_success_when_failed);
    });

    it('resistance who plays a fail card is penalized heavily (loyalty break)', () => {
        const r = computeGamePoints('1', [row({
            vote_status: true,
            mission_status: false,
            count_spies_nominated: 0,
            mission_participent_userids: ['1', '2'],
            vote_poll: { '1': true },
            mission_cards: { '1': 'fail', '2': 'success' },
        })])!;
        expect(r.breakdown.played_fail_card).toBe(RESISTANCE_ACTION_POINTS.played_fail_card);
    });
});

describe('computeGamePoints — leadership', () => {
    it('led_clean_team rewards proposing a clean team (resistance)', () => {
        const r = computeGamePoints('1', [row({
            leader_userid: '1',
            count_spies_nominated: 0,
            mission_participent_userids: ['1', '2'],
            vote_status: true,
            vote_poll: { '1': true },
        })])!;
        expect(r.breakdown.led_clean_team).toBe(RESISTANCE_ACTION_POINTS.led_clean_team);
    });

    it('led_dirty_team penalizes resistance leader who picked a spy', () => {
        const r = computeGamePoints('1', [row({
            leader_userid: '1',
            count_spies_nominated: 1,
            mission_participent_userids: ['1', '4'],
            vote_status: false,
            vote_poll: { '1': true },
        })])!;
        expect(r.breakdown.led_dirty_team).toBe(RESISTANCE_ACTION_POINTS.led_dirty_team);
        expect(r.breakdown.led_dirty_team_approved).toBeUndefined();
    });

    it('spy leader who pushes a dirty team through gets the approved bonus', () => {
        const r = computeGamePoints('4', [row({
            leader_userid: '4',
            count_spies_nominated: 1,
            mission_participent_userids: ['4', '5'],
            vote_status: true,
            vote_poll: { '4': true },
            resistance_win: false,
        })])!;
        expect(r.breakdown.led_dirty_team).toBe(SPY_ACTION_POINTS.led_dirty_team);
        expect(r.breakdown.led_dirty_team_approved).toBe(SPY_ACTION_POINTS.led_dirty_team_approved);
    });
});

describe('computeGamePoints — active suspicion (resistance only)', () => {
    it('correctly identifying a spy at γ=5 scores +5; mis-marking resistance at γ=3 scores -3', () => {
        const r = computeGamePoints('3', [row({
            suspicions: { '3': { '4': 5, '2': 3 } },
        })])!;
        expect(r.breakdown.suspicion_correct_per_gamma).toBe(5);
        expect(r.breakdown.suspicion_incorrect_per_gamma).toBe(-3);
    });

    it('clamps γ to [0, 5]', () => {
        const r = computeGamePoints('3', [row({
            suspicions: { '3': { '4': 999, '2': -1 } },
        })])!;
        expect(r.breakdown.suspicion_correct_per_gamma).toBe(5);
        expect(r.breakdown.suspicion_incorrect_per_gamma).toBeUndefined();
    });
});

describe('computeGamePoints — passive suspicion (the user example)', () => {
    // 5-player game; resistance voters {1, 2, 3} all submit suspicions this round.
    // Spy player 4 is being passively scored.
    function passiveRow(overrides: Partial<MetricsRow>): MetricsRow {
        return row({
            vote_status: false,                 // doesn't matter, just need a row
            vote_poll: { '4': false },          // spy 4 voted reject (the "one bad vote")
            count_spies_nominated: 1,           // dirty team — reject_dirty_team penalty (-3)
            mission_participent_userids: ['1', '4'],
            resistance_win: false,
            ...overrides,
        });
    }

    it('three resistance voters all OMIT the spy → trust >> the bad reject', () => {
        const rows = [passiveRow({
            suspicions: {
                '1': { '5': 4 },                 // marks the OTHER spy, not 4
                '2': { '5': 3 },
                '3': { '5': 2 },
            },
        })];

        const r = computeGamePoints('4', rows)!;
        // Catalog v3: passive scoring is averaged per voter — all three
        // voters trusting = exactly one full catalog value, regardless of
        // table size.
        expect(r.breakdown.trusted_by_resistance_per_voter).toBeCloseTo(SPY_ACTION_POINTS.trusted_by_resistance_per_voter);
        // The single reject_dirty_team is -3
        expect(r.breakdown.reject_dirty_team).toBe(SPY_ACTION_POINTS.reject_dirty_team);
        // Net of these two effects > 0 (the user's "way overshadows" claim).
        const trust = r.breakdown.trusted_by_resistance_per_voter ?? 0;
        const badVote = r.breakdown.reject_dirty_team ?? 0;
        expect(trust + badVote).toBeGreaterThan(0);
    });

    it('the more confident the suspicion, the bigger the spy penalty', () => {
        const lowConf = computeGamePoints('4', [passiveRow({
            suspicions: { '1': { '4': 1 } },
        })])!;
        const highConf = computeGamePoints('4', [passiveRow({
            suspicions: { '1': { '4': 5 } },
        })])!;
        expect(highConf.breakdown.suspected_by_resistance_per_gamma!).toBeLessThan(lowConf.breakdown.suspected_by_resistance_per_gamma!);
        // Specifically: -2 × 5 < -2 × 1
        expect(highConf.breakdown.suspected_by_resistance_per_gamma).toBe(SPY_ACTION_POINTS.suspected_by_resistance_per_gamma * 5);
        expect(lowConf.breakdown.suspected_by_resistance_per_gamma).toBe(SPY_ACTION_POINTS.suspected_by_resistance_per_gamma * 1);
    });

    it('mixed: 2 voters omit, 1 marks at γ=2 → still slight net penalty per design', () => {
        const r = computeGamePoints('4', [passiveRow({
            suspicions: {
                '1': { '5': 5 },                 // omitted spy 4
                '2': { '5': 5 },                 // omitted spy 4
                '3': { '4': 2 },                 // marked spy 4 at γ=2
            },
        })])!;
        const trust = (r.breakdown.trusted_by_resistance_per_voter ?? 0);
        const susp  = (r.breakdown.suspected_by_resistance_per_gamma ?? 0);
        // v3 averaging over 3 voters: 2/3 of full trust, γ=2 mark ÷ 3.
        expect(trust).toBeCloseTo(SPY_ACTION_POINTS.trusted_by_resistance_per_voter * (2 / 3));
        expect(susp).toBeCloseTo(SPY_ACTION_POINTS.suspected_by_resistance_per_gamma * (2 / 3));
    });

    it('spy suspicions submitted by other spies are ignored entirely (only resistance voters count)', () => {
        const r = computeGamePoints('4', [passiveRow({
            suspicions: {
                '5': { '4': 5 },                 // another spy "marks" spy 4 — ignored
            },
        })])!;
        expect(r.breakdown.trusted_by_resistance_per_voter).toBeUndefined();
        expect(r.breakdown.suspected_by_resistance_per_gamma).toBeUndefined();
    });

    it('a γ=0 (empty slot) submission counts as trust, not a mark', () => {
        const r = computeGamePoints('4', [passiveRow({
            suspicions: { '1': { '4': 0 } },
        })])!;
        expect(r.breakdown.trusted_by_resistance_per_voter).toBe(SPY_ACTION_POINTS.trusted_by_resistance_per_voter);
        expect(r.breakdown.suspected_by_resistance_per_gamma).toBeUndefined();
    });

    it('resistance also gets passive scoring, just gentler', () => {
        const r = computeGamePoints('1', [row({
            vote_poll: { '1': true },
            count_spies_nominated: 0,
            suspicions: {
                '2': { '4': 5 },                 // omitted player 1
                '3': { '1': 4 },                 // marked player 1 at γ=4
            },
        })])!;
        // v3 averaging over 2 voters: half trust + a γ=4 mark ÷ 2.
        expect(r.breakdown.trusted_by_resistance_per_voter).toBeCloseTo(RESISTANCE_ACTION_POINTS.trusted_by_resistance_per_voter / 2);
        expect(r.breakdown.suspected_by_resistance_per_gamma).toBeCloseTo(RESISTANCE_ACTION_POINTS.suspected_by_resistance_per_gamma * 2);
    });
});

describe('computeGamePoints — game outcome', () => {
    it('winners get game_won, losers get game_lost', () => {
        const winnerR = computeGamePoints('3', [row({})])!;
        expect(winnerR.breakdown.game_won).toBe(RESISTANCE_ACTION_POINTS.game_won);
        expect(winnerR.breakdown.game_lost).toBeUndefined();

        const loserSpy = computeGamePoints('4', [row({})])!;
        expect(loserSpy.breakdown.game_lost).toBe(SPY_ACTION_POINTS.game_lost);
        expect(loserSpy.breakdown.game_won).toBeUndefined();
    });
});
