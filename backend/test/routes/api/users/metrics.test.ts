import { describe, it, expect } from 'vitest'
import {computeMetrics, MetricsRow} from '../../../../routes/api/users/_userid/metrics/index.js'

function makeRound(overrides: {
    game_id: number;
    round_index_in_game: number;
    players: Record<string, string | null>;
    leader_userid?: string | null;
    mission_participent_userids?: string[] | null;
    count_spies_nominated?: number | null;
    vote_status?: boolean | null;
    resistance_win?: boolean | null;
    mission_status?: boolean | null;
    suspicions?: Record<string, Record<string, number>> | null;
}): MetricsRow {
    return {
        game_id: overrides.game_id,
        round_id: Math.random(),
        leader_userid: overrides.leader_userid ?? null,
        mission_participent_userids: overrides.mission_participent_userids ?? [],
        count_spies_nominated: overrides.count_spies_nominated ?? 0,
        vote_status: overrides.vote_status ?? null,
        mission_status: overrides.mission_status ?? null,
        resistance_win: overrides.resistance_win ?? null,
        suspicions: overrides.suspicions ?? null,
        players: overrides.players,
        round_index_in_game: overrides.round_index_in_game,
    };
}

const PLAYERS_5 = {
    '1': 'resistance',
    '2': 'resistance',
    '3': 'resistance',
    '4': 'spy',
    '5': 'spy',
} satisfies Record<string, string | null>;

const PLAYERS_5_USER1_SPY = {
    '1': 'spy',
    '2': 'resistance',
    '3': 'resistance',
    '4': 'resistance',
    '5': 'spy',
} satisfies Record<string, string | null>;

describe('Metrics', () => {

    describe('computeMetrics — no rounds', () => {
        it('returns all nulls when there are no rounds', () => {
            const result = computeMetrics('1', []);
            expect(result.resistance.RoS_L).toBeNull();
            expect(result.resistance.RoCD_L).toBeNull();
            expect(result.spy.RoI_L).toBeNull();
            expect(result.spy.RoIF_L).toBeNull();
        });
    });

    describe('RoS_L', () => {
        it('counts a finished resistance win correctly', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 0,
                    players: PLAYERS_5,
                    resistance_win: true,
                }),
            ];
            const { counts } = computeMetrics('1', rounds);
            expect(counts.games).toBe(1);
            expect(counts.wins).toBe(1);
            expect(counts.losses).toBe(0);
            expect(counts.gamesAsResistance).toBe(1);
            expect(counts.gamesAsSpy).toBe(0);
        });

        it('counts a finished spy loss correctly', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 0,
                    players: PLAYERS_5_USER1_SPY,
                    resistance_win: true,
                }),
            ];
            const { counts } = computeMetrics('1', rounds);
            expect(counts.games).toBe(1);
            expect(counts.wins).toBe(0);
            expect(counts.losses).toBe(1);
            expect(counts.gamesAsResistance).toBe(0);
            expect(counts.gamesAsSpy).toBe(1);
        });

        it('excludes unfinished games from all counts', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 0,
                    players: PLAYERS_5,
                    resistance_win: null,
                }),
            ];
            const { counts } = computeMetrics('1', rounds);
            expect(counts.games).toBe(0);
            expect(counts.wins).toBe(0);
            expect(counts.losses).toBe(0);
            expect(counts.gamesAsResistance).toBe(0);
            expect(counts.gamesAsSpy).toBe(0);
        });

        it('only counts finished games when mixed with unfinished', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 0,
                    players: PLAYERS_5,
                    resistance_win: true,
                }),
                makeRound({
                    game_id: 2,
                    round_index_in_game: 0,
                    players: PLAYERS_5,
                    resistance_win: null,
                }),
            ];
            const { counts } = computeMetrics('1', rounds);
            expect(counts.games).toBe(1);
            expect(counts.wins).toBe(1);
            expect(counts.losses).toBe(0);
        });

        it('returns all zeros and nulls for a player with no games', () => {
            const { counts, resistance, spy } = computeMetrics('1', []);
            expect(counts.games).toBe(0);
            expect(counts.wins).toBe(0);
            expect(counts.losses).toBe(0);
            expect(counts.gamesAsResistance).toBe(0);
            expect(counts.gamesAsSpy).toBe(0);
            expect(resistance.RoS_L).toBeNull();
            expect(resistance.RoCD_L).toBeNull();
            expect(spy.RoI_L).toBeNull();
            expect(spy.RoIF_L).toBeNull();
        });
    });

    describe('RoS_L — Lifetime Rate of Sherlock', () => {
        it('perfect score: one correct high-confidence spy vote', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'4': 5}},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeCloseTo(0.5);
        });

        it('worst score: one wrong high-confidence vote on a resistance member', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'2': 5}},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeCloseTo(-0.5);
        });

        it('mixed votes: one correct and one incorrect in same round', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'4': 3, '2': 2}},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeCloseTo(0.1);
        });

        it('averages RoS_G across multiple games', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'4': 5}},
                }),
                makeRound({
                    game_id: 2,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'5': 0}},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeCloseTo(0.25);
        });

        it('accumulates votes across multiple rounds in the same game', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'4': 4}},
                }),
                makeRound({
                    game_id: 1,
                    round_index_in_game: 2,
                    players: PLAYERS_5,
                    suspicions: {'1': {'5': 2}},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeCloseTo(0.3);
        });

        it('returns null when user only played as spy (RoS is resistance-only)', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: {'1': {'4': 5}},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeNull();
        });

        it('returns null when user played Resistance but submitted no suspicion votes', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {},
                }),
            ];
            const {RoS_L} = computeMetrics('1', rounds).resistance;
            expect(RoS_L).toBeNull();
        });
    });

    describe('RoCD_L - Lifetime Rate of CD', () => {
        it('maximum RoCD: leader proposes all spies', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    leader_userid: '1',
                    mission_participent_userids: ['4', '5'],
                }),
            ];
            const {RoCD_L} = computeMetrics('1', rounds).resistance;
            expect(RoCD_L).toBeCloseTo(1.0);
        });

        it('minimum RoCD: leader proposes no spies', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    leader_userid: '1',
                    mission_participent_userids: ['2', '3'],
                }),
            ];
            const {RoCD_L} = computeMetrics('1', rounds).resistance;
            expect(RoCD_L).toBeCloseTo(0.0);
        });

        it('returns null when user only led the first round (excluded by definition)', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 0,
                    players: PLAYERS_5,
                    leader_userid: '1',
                    mission_participent_userids: ['4', '5'],
                }),
            ];
            const {RoCD_L} = computeMetrics('1', rounds).resistance;
            expect(RoCD_L).toBeNull();
        });

        it('averages s/t across multiple leader rounds', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    leader_userid: '1',
                    mission_participent_userids: ['1', '4'],
                }),
                makeRound({
                    game_id: 1,
                    round_index_in_game: 2,
                    players: PLAYERS_5,
                    leader_userid: '1',
                    mission_participent_userids: ['2', '3', '4'],
                }),
            ];
            const {RoCD_L} = computeMetrics('1', rounds).resistance;
            expect(RoCD_L).toBeCloseTo(5 / 12);
        });

        it('returns null when user was never a leader', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    leader_userid: '2',
                    mission_participent_userids: ['1', '4'],
                }),
            ];
            const {RoCD_L} = computeMetrics('1', rounds).resistance;
            expect(RoCD_L).toBeNull();
        });
    });

    describe('RoI_L - Lifetime Rate of Illusion', () => {
        it('perfect illusion: no suspicion votes received as spy', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: {'2': {'3': 3}},
                }),
            ];
            const {RoI_L} = computeMetrics('1', rounds).spy;
            expect(RoI_L).toBeCloseTo(1.0);
        });

        it('worst illusion: targeted with max confidence, minimal other suspicion', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: {'2': {'1': 5}},
                }),
            ];
            const {RoI_L} = computeMetrics('1', rounds).spy;
            expect(RoI_L).toBeCloseTo(-1.0);
        });

        it('partial suspicion: targeted once among two total suspicion entries', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: {'2': {'1': 3, '5': 2}},
                }),
            ];
            const {RoI_L} = computeMetrics('1', rounds).spy;
            expect(RoI_L).toBeCloseTo(0.4);
        });

        it('averages RoI_G across multiple spy games', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: {'2': {'1': 5}},
                }),
                makeRound({
                    game_id: 2,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: {'2': {'3': 4}},
                }),
            ];
            const {RoI_L} = computeMetrics('1', rounds).spy;
            expect(RoI_L).toBeCloseTo(0.0);
        });

        it('returns null when user only played as Resistance', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    suspicions: {'1': {'4': 5}},
                }),
            ];
            const {RoI_L} = computeMetrics('1', rounds).spy;
            expect(RoI_L).toBeNull();
        });

        it('returns 1.0 when user was a spy in a game with no suspicion records', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    suspicions: null as any,
                }),
            ];
            const {RoI_L} = computeMetrics('1', rounds).spy;
            expect(RoI_L).toBeCloseTo(1.0);
        });
    });

    describe('RoIF_L - Lifetime Rate of Infiltration', () => {
        it('always infiltrates: proposed once, vote passed', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    mission_participent_userids: ['1', '2'],
                    vote_status: true,
                }),
            ];
            const {RoIF_L} = computeMetrics('1', rounds).spy;
            expect(RoIF_L).toBeCloseTo(1.0);
        });

        it('never infiltrates: proposed once, vote rejected', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    mission_participent_userids: ['1', '2'],
                    vote_status: false,
                }),
            ];
            const {RoIF_L} = computeMetrics('1', rounds).spy;
            expect(RoIF_L).toBeCloseTo(0.0);
        });

        it('half infiltration rate: proposed twice, one pass and one rejection', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 0,
                    players: PLAYERS_5_USER1_SPY,
                    mission_participent_userids: ['1', '2'],
                    vote_status: false,
                }),
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    mission_participent_userids: ['1', '3'],
                    vote_status: true,
                }),
            ];
            const {RoIF_L} = computeMetrics('1', rounds).spy;
            expect(RoIF_L).toBeCloseTo(0.5);
        });

        it('returns null when spy was never proposed to a team', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    mission_participent_userids: ['2', '3'],
                    vote_status: true,
                }),
            ];
            const {RoIF_L} = computeMetrics('1', rounds).spy;
            expect(RoIF_L).toBeNull();
        });

        it('returns null when user only played as Resistance', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    mission_participent_userids: ['1', '2'],
                    vote_status: true,
                }),
            ];
            const {RoIF_L} = computeMetrics('1', rounds).spy;
            expect(RoIF_L).toBeNull();
        });
    });


    describe('Role isolation - resistance metrics are null when spy and vice versa', () => {
        it('spy games produce null resistance metrics', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5_USER1_SPY,
                    mission_participent_userids: ['1', '2'],
                    vote_status: true,
                    suspicions: {'2': {'3': 2}},
                }),
            ];
            const result = computeMetrics('1', rounds);
            expect(result.resistance.RoS_L).toBeNull();
            expect(result.resistance.RoCD_L).toBeNull();
            expect(result.spy.RoIF_L).not.toBeNull();
        });

        it('resistance games produce null spy metrics', () => {
            const rounds = [
                makeRound({
                    game_id: 1,
                    round_index_in_game: 1,
                    players: PLAYERS_5,
                    leader_userid: '1',
                    mission_participent_userids: ['1', '4'],
                    vote_status: true,
                    suspicions: {'1': {'4': 3}},
                }),
            ];
            const result = computeMetrics('1', rounds);
            expect(result.spy.RoI_L).toBeNull();
            expect(result.spy.RoIF_L).toBeNull();
            expect(result.resistance.RoS_L).not.toBeNull();
        });
    });
});