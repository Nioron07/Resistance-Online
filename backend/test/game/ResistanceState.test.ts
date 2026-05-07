import { describe, it, expect } from 'vitest';
import { ResistanceState } from '../../game/ResistanceState.js';
import { GameState, PlayerState, RoleName } from '../../game/types/GameTypes.js';

function makePlayer(id: number, role: RoleName | undefined, connected: boolean): PlayerState {
    return {
        playerId: id,
        connected,
        plotCardsInHand: [],
        role,
        knownRoles: undefined,
    };
}

function buildState(opts: {
    seatOrder: number[];
    leaderId: number;
    roles: Record<number, RoleName | undefined>;
    connected: Record<number, boolean>;
}): ResistanceState {
    const state = new ResistanceState();
    state.seatOrder = opts.seatOrder;
    state.leaderId = opts.leaderId;
    for (const id of opts.seatOrder) {
        state.players.set(id, makePlayer(id, opts.roles[id], opts.connected[id] ?? true));
    }
    return state;
}

describe('ResistanceState.getNextLeader', () => {
    it('rotates to the next seated player when everyone is connected', () => {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 1,
            roles: {},
            connected: { 1: true, 2: true, 3: true, 4: true, 5: true },
        });
        expect(state.getNextLeader()).toBe(2);
    });

    it('skips a disconnected next player', () => {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 1,
            roles: {},
            connected: { 1: true, 2: false, 3: true, 4: true, 5: true },
        });
        expect(state.getNextLeader()).toBe(3);
    });

    it('skips multiple disconnected players in a row', () => {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 1,
            roles: {},
            connected: { 1: true, 2: false, 3: false, 4: false, 5: true },
        });
        expect(state.getNextLeader()).toBe(5);
    });

    it('wraps around the seat order', () => {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 5,
            roles: {},
            connected: { 1: true, 2: true, 3: true, 4: true, 5: true },
        });
        expect(state.getNextLeader()).toBe(1);
    });

    it('returns the current leader if nobody else is connected', () => {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 1,
            roles: {},
            connected: { 1: true, 2: false, 3: false, 4: false, 5: false },
        });
        expect(state.getNextLeader()).toBe(1);
    });

    it('returns leaderId when seatOrder is empty', () => {
        const state = new ResistanceState();
        state.leaderId = 7;
        expect(state.getNextLeader()).toBe(7);
    });
});

describe('ResistanceState.allSusCast', () => {
    it('returns true once every resistance player has submitted (spies skipped)', () => {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 1,
            roles: { 1: 'resistance', 2: 'resistance', 3: 'resistance', 4: 'spy', 5: 'spy' },
            connected: { 1: true, 2: true, 3: true, 4: true, 5: true },
        });

        state.pendingSuspicions[1] = {};
        state.pendingSuspicions[2] = {};
        expect(state.allSusCast()).toBe(false);

        state.pendingSuspicions[3] = {};
        // Even with 0 spy submissions, the round should be complete.
        expect(state.allSusCast()).toBe(true);
    });

    it('does not require any submissions when there are no resistance players', () => {
        const state = buildState({
            seatOrder: [1, 2],
            leaderId: 1,
            roles: { 1: 'spy', 2: 'spy' },
            connected: { 1: true, 2: true },
        });
        expect(state.allSusCast()).toBe(true);
    });
});

describe('ResistanceState.serializeFor', () => {
    function baseStateWithRoles(): ResistanceState {
        const state = buildState({
            seatOrder: [1, 2, 3, 4, 5],
            leaderId: 1,
            roles: { 1: 'resistance', 2: 'resistance', 3: 'resistance', 4: 'spy', 5: 'spy' },
            connected: { 1: true, 2: true, 3: true, 4: true, 5: true },
        });
        state.phase = 'voting';
        return state;
    }

    it('exposes pendingVotes player ids without their values', () => {
        const state = baseStateWithRoles();
        state.pendingVotes[1] = true;
        state.pendingVotes[3] = false;

        const view = JSON.parse(state.serializeFor(1)) as GameState;
        expect(view.votedPlayerIds.sort()).toEqual([1, 3]);
        // The actual booleans must NOT be in the serialized state.
        expect(JSON.stringify(view)).not.toMatch(/"pendingVotes"/);
    });

    it('exposes submittedSuspicionPlayerIds', () => {
        const state = baseStateWithRoles();
        state.phase = 'suspicion';
        state.pendingSuspicions[2] = { 4: 9 };

        const view = JSON.parse(state.serializeFor(1)) as GameState;
        expect(view.submittedSuspicionPlayerIds).toEqual([2]);
    });

    it('exposes playedMissionCardPlayerIds', () => {
        const state = baseStateWithRoles();
        state.phase = 'mission';
        state.pendingMissionCards[1] = true;
        state.pendingMissionCards[2] = false;

        const view = JSON.parse(state.serializeFor(1)) as GameState;
        expect(view.playedMissionCardPlayerIds.sort()).toEqual([1, 2]);
    });

    it('redacts other players roles for the requesting player', () => {
        const state = baseStateWithRoles();
        const view = JSON.parse(state.serializeFor(1)) as GameState;

        expect(view.players[1]!.role).toBe('resistance');
        expect(view.players[2]!.role).toBeUndefined();
        expect(view.players[4]!.role).toBeUndefined();
    });
});
