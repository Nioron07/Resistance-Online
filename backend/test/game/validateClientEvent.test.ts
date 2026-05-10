import { describe, it, expect } from 'vitest';
import { validateClientEvent } from '../../game/validateClientEvent.js';

describe('validateClientEvent', () => {
    describe('envelope', () => {
        it('rejects non-string event', () => {
            const r = validateClientEvent(42, {});
            expect(r.ok).toBe(false);
        });

        it('rejects unknown event names', () => {
            const r = validateClientEvent('totally:made-up', {});
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toMatch(/unknown event/);
        });

        it('rejects non-object data', () => {
            const r = validateClientEvent('vote:cast', null);
            expect(r.ok).toBe(false);
        });

        it('rejects array data', () => {
            const r = validateClientEvent('vote:cast', [true]);
            expect(r.ok).toBe(false);
        });
    });

    describe('game:configure', () => {
        it('accepts valid payload', () => {
            const r = validateClientEvent('game:configure', {
                modulesEnabled: ['assassin'],
                optionalRoles: ['commander', 'assassin'],
            });
            expect(r.ok).toBe(true);
        });

        it('rejects non-string modules', () => {
            const r = validateClientEvent('game:configure', {
                modulesEnabled: [1, 2],
                optionalRoles: [],
            });
            expect(r.ok).toBe(false);
        });

        it('rejects unknown roles', () => {
            const r = validateClientEvent('game:configure', {
                modulesEnabled: [],
                optionalRoles: ['president'],
            });
            expect(r.ok).toBe(false);
        });
    });

    describe('game:start', () => {
        it('accepts valid payload', () => {
            const r = validateClientEvent('game:start', {
                leaderId: 1,
                seatOrder: [1, 2, 3, 4, 5],
            });
            expect(r.ok).toBe(true);
        });

        it('rejects non-integer leaderId', () => {
            const r = validateClientEvent('game:start', {
                leaderId: 1.5,
                seatOrder: [1, 2, 3],
            });
            expect(r.ok).toBe(false);
        });

        it('rejects non-array seatOrder', () => {
            const r = validateClientEvent('game:start', {
                leaderId: 1,
                seatOrder: 'first',
            });
            expect(r.ok).toBe(false);
        });

        it('accepts numeric strings (Postgres BIGINT-as-string compatibility)', () => {
            const r = validateClientEvent('game:start', {
                leaderId: '1',
                seatOrder: ['1', '2', 3],
            });
            expect(r.ok).toBe(true);
        });

        it('rejects seatOrder containing non-numeric strings', () => {
            const r = validateClientEvent('game:start', {
                leaderId: 1,
                seatOrder: [1, 'two', 3],
            });
            expect(r.ok).toBe(false);
        });
    });

    describe('role:submit', () => {
        it('accepts a known role', () => {
            const r = validateClientEvent('role:submit', { role: 'commander' });
            expect(r.ok).toBe(true);
        });

        it('rejects an unknown role', () => {
            const r = validateClientEvent('role:submit', { role: 'jester' });
            expect(r.ok).toBe(false);
        });

        it('rejects non-string role', () => {
            const r = validateClientEvent('role:submit', { role: 7 });
            expect(r.ok).toBe(false);
        });
    });

    describe('nomination:submit', () => {
        it('accepts a unique team', () => {
            const r = validateClientEvent('nomination:submit', { team: [1, 2, 3] });
            expect(r.ok).toBe(true);
        });

        it('rejects non-array team', () => {
            const r = validateClientEvent('nomination:submit', { team: 'all' });
            expect(r.ok).toBe(false);
        });

        it('rejects team with duplicates', () => {
            const r = validateClientEvent('nomination:submit', { team: [1, 2, 2] });
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toMatch(/duplicate/);
        });

        it('rejects team with non-integer ids', () => {
            const r = validateClientEvent('nomination:submit', { team: [1, 2.5] });
            expect(r.ok).toBe(false);
        });
    });

    describe('vote:cast', () => {
        it('accepts true', () => {
            expect(validateClientEvent('vote:cast', { vote: true }).ok).toBe(true);
        });

        it('accepts false', () => {
            expect(validateClientEvent('vote:cast', { vote: false }).ok).toBe(true);
        });

        it('rejects non-boolean', () => {
            expect(validateClientEvent('vote:cast', { vote: 1 }).ok).toBe(false);
        });
    });

    describe('sus:submit', () => {
        it('accepts a record of finite numbers', () => {
            const r = validateClientEvent('sus:submit', { sus: { 1: 5, 2: 3.5 } });
            expect(r.ok).toBe(true);
        });

        it('rejects non-object sus', () => {
            const r = validateClientEvent('sus:submit', { sus: 'high' });
            expect(r.ok).toBe(false);
        });

        it('rejects Infinity values', () => {
            const r = validateClientEvent('sus:submit', { sus: { 1: Infinity } });
            expect(r.ok).toBe(false);
        });

        it('rejects NaN values', () => {
            const r = validateClientEvent('sus:submit', { sus: { 1: NaN } });
            expect(r.ok).toBe(false);
        });

        it('rejects non-numeric keys', () => {
            const r = validateClientEvent('sus:submit', { sus: { foo: 1 } });
            expect(r.ok).toBe(false);
        });
    });

    describe('mission:play-card', () => {
        it('accepts true', () => {
            expect(validateClientEvent('mission:play-card', { card: true }).ok).toBe(true);
        });

        it('rejects non-boolean', () => {
            expect(validateClientEvent('mission:play-card', { card: 'success' }).ok).toBe(false);
        });
    });
});
