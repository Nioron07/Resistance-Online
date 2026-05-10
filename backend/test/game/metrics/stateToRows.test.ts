import { describe, it, expect } from 'vitest';
import { ResistanceState } from '../../../game/ResistanceState.js';
import { metricsRowsFromState } from '../../../game/metrics/stateToRows.js';
import type { NominationAttempt, MissionResult, RoleName } from '../../../game/types/GameTypes.js';

function makeState(opts: {
    roles: Record<number, RoleName>;
    seatOrder: number[];
    missions: MissionResult[];
    pendingNominations?: NominationAttempt[];
    endWinner?: 'spies' | 'resistance' | null;
}): ResistanceState {
    const state = new ResistanceState();
    state.seatOrder = opts.seatOrder;
    for (const id of opts.seatOrder) {
        state.players.set(id, {
            playerId: id,
            connected: true,
            plotCardsInHand: [],
            role: opts.roles[id],
            knownRoles: undefined,
        });
    }
    state.missions = opts.missions;
    state.pendingNominations = opts.pendingNominations ?? [];
    state.endWinner = 'endWinner' in opts ? opts.endWinner! : 'resistance';
    return state;
}

function nom(opts: Partial<NominationAttempt> & { leader: number; proposedTeam: number[]; outcome: boolean; votes: Record<number, boolean> }): NominationAttempt {
    return {
        round: 0,
        numberOfSpies: 0,
        suspicions: undefined,
        ...opts,
    };
}

describe('metricsRowsFromState', () => {
    it('emits one row per finalized nomination, in order', () => {
        const state = makeState({
            roles: { 1: 'resistance', 2: 'resistance', 3: 'resistance', 4: 'spy', 5: 'spy' },
            seatOrder: [1, 2, 3, 4, 5],
            missions: [{
                mission: 0,
                nominations: [
                    nom({ leader: 1, proposedTeam: [1, 2], outcome: false, votes: { 1: true, 2: true, 3: false, 4: false, 5: false } }),
                    nom({ leader: 2, proposedTeam: [2, 3], outcome: true,  votes: { 1: true, 2: true, 3: true, 4: true, 5: true } }),
                ],
                cards: [{ playerId: 2, card: true }, { playerId: 3, card: true }],
                failCount: 0,
                success: true,
            }],
        });
        const rows = metricsRowsFromState(state, 42);
        expect(rows.length).toBe(2);
        expect(rows[0]!.vote_status).toBe(false);
        expect(rows[1]!.vote_status).toBe(true);
        expect(rows[0]!.mission_status).toBe(null);          // not the approved nomination
        expect(rows[1]!.mission_status).toBe(true);          // approved + mission succeeded
    });

    it('only the approved attempt of a mission carries the mission_cards record', () => {
        const state = makeState({
            roles: { 1: 'resistance', 2: 'resistance', 3: 'resistance', 4: 'spy', 5: 'spy' },
            seatOrder: [1, 2, 3, 4, 5],
            missions: [{
                mission: 0,
                nominations: [
                    nom({ leader: 1, proposedTeam: [1, 2], outcome: false, votes: { 1: true, 2: true, 3: false, 4: false, 5: false } }),
                    nom({ leader: 2, proposedTeam: [4, 5], outcome: true,  votes: { 1: false, 2: true, 3: false, 4: true, 5: true } }),
                ],
                cards: [{ playerId: 4, card: false }, { playerId: 5, card: false }],
                failCount: 2,
                success: false,
            }],
            endWinner: 'spies',
        });
        const rows = metricsRowsFromState(state, 7);
        expect(rows[0]!.mission_cards).toBe(null);
        expect(rows[1]!.mission_cards).toEqual({ '4': 'fail', '5': 'fail' });
    });

    it('walks pendingNominations after missions for a 5-rejection game-end', () => {
        const state = makeState({
            roles: { 1: 'resistance', 2: 'resistance', 3: 'resistance', 4: 'spy', 5: 'spy' },
            seatOrder: [1, 2, 3, 4, 5],
            missions: [],
            pendingNominations: [
                nom({ leader: 1, proposedTeam: [1, 2], outcome: false, votes: { 1: true, 2: true, 3: false, 4: false, 5: false } }),
                nom({ leader: 2, proposedTeam: [2, 3], outcome: false, votes: { 1: true, 2: true, 3: false, 4: false, 5: false } }),
            ],
            endWinner: 'spies',
        });
        const rows = metricsRowsFromState(state, 9);
        expect(rows.length).toBe(2);
        expect(rows.every(r => r.mission_status === null)).toBe(true);
        expect(rows.every(r => r.mission_cards === null)).toBe(true);
    });

    it('produces players JSONB with stringified userid keys (matches DB shape)', () => {
        const state = makeState({
            roles: { 1: 'resistance', 4: 'spy' },
            seatOrder: [1, 4],
            missions: [{
                mission: 0,
                nominations: [nom({ leader: 1, proposedTeam: [1, 4], outcome: true, votes: { 1: true, 4: true } })],
                cards: [{ playerId: 1, card: true }, { playerId: 4, card: true }],
                failCount: 0,
                success: true,
            }],
        });
        const row = metricsRowsFromState(state, 1)[0]!;
        expect(row.players).toEqual({ '1': 'resistance', '4': 'spy' });
        expect(row.leader_userid).toBe('1');
        expect(row.mission_participent_userids).toEqual(['1', '4']);
    });

    it('encodes endWinner into resistance_win', () => {
        const base = {
            roles: { 1: 'resistance', 4: 'spy' } as Record<number, RoleName>,
            seatOrder: [1, 4],
            missions: [],
            pendingNominations: [
                nom({ leader: 1, proposedTeam: [1], outcome: false, votes: { 1: false, 4: false } }),
            ],
        };
        expect(metricsRowsFromState(makeState({ ...base, endWinner: 'resistance' }), 1)[0]!.resistance_win).toBe(true);
        expect(metricsRowsFromState(makeState({ ...base, endWinner: 'spies' }), 1)[0]!.resistance_win).toBe(false);
        expect(metricsRowsFromState(makeState({ ...base, endWinner: null }), 1)[0]!.resistance_win).toBe(null);
    });
});
