import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stage env vars + jest.fn instances BEFORE the strategy module is imported.
// vi.hoisted runs before any top-level import, so these are present when
// GoogleStrategy is constructed at import time.
const { getUseridByProviderUID, create } = vi.hoisted(() => {
    process.env.GOOGLE_CLIENT_ID     ??= 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET ??= 'test-client-secret';
    process.env.BACKEND_BASE_URL     ??= 'http://localhost:8080';
    return {
        getUseridByProviderUID: vi.fn(),
        create: vi.fn(),
    };
});

vi.mock('../../../utils/db-queries/DataAccessClass.js', () => ({
    DAC: {
        users: {
            provider: () => ({ uid: () => ({ getUseridByProviderUID }) }),
            create,
        },
    },
}));

/**
 * The strategy file builds a GoogleStrategy at import time and registers our
 * verify callback. We dig the verify out so we can drive it directly.
 */
import { Google } from '../../../utils/passport-strategies/google.js';

interface VerifyArgs {
    accessToken?: string;
    refreshToken?: string;
    profile: { id: string; displayName?: string; photos?: Array<{ value: string }> };
}

function callVerify (args: VerifyArgs): Promise<{ err: unknown; user?: { userid: number } }> {
    return new Promise(resolve => {
        // The strategy's `_verify` is the function we passed to its constructor.
        const verify = (Google as unknown as { _verify: (
            at: string, rt: string, p: VerifyArgs['profile'], done: (err: unknown, user?: { userid: number }) => void,
        ) => void })._verify;
        verify(
            args.accessToken ?? 'access',
            args.refreshToken ?? 'refresh',
            args.profile,
            (err, user) => resolve(user === undefined ? { err } : { err, user }),
        );
    });
}

describe('passport google strategy verify callback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the existing userid when the Google UID is already known', async () => {
        getUseridByProviderUID.mockResolvedValueOnce(42);
        const out = await callVerify({
            profile: { id: 'g-9001', displayName: 'Alice', photos: [{ value: 'http://example.com/a.png' }] },
        });
        expect(out.err).toBeNull();
        expect(out.user).toEqual({ userid: 42 });
        expect(create).not.toHaveBeenCalled();
    });

    it('creates a new user when the Google UID has not been seen before', async () => {
        getUseridByProviderUID.mockResolvedValueOnce(undefined);
        create.mockResolvedValueOnce(99);
        const profile = { id: 'g-1234', displayName: 'Bob', photos: [{ value: 'http://example.com/b.png' }] };
        const out = await callVerify({ profile });

        expect(out.err).toBeNull();
        expect(out.user).toEqual({ userid: 99 });
        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith(
            'Bob',
            'http://example.com/b.png',
            'google',
            expect.objectContaining({ uid: 'g-1234', full_object: profile }),
        );
    });

    it('falls back to a generated username when displayName is missing', async () => {
        getUseridByProviderUID.mockResolvedValueOnce(undefined);
        create.mockResolvedValueOnce(7);
        const profile = { id: 'g-abcdef123456', photos: [{ value: 'http://example.com/x.png' }] };
        await callVerify({ profile });
        expect(create.mock.calls[0]![0]).toBe('User123456'); // last 6 chars of profile.id
    });

    it('falls back to empty string for pfp when photos is missing', async () => {
        getUseridByProviderUID.mockResolvedValueOnce(undefined);
        create.mockResolvedValueOnce(11);
        const profile = { id: 'g-77', displayName: 'Carol' };
        await callVerify({ profile });
        expect(create.mock.calls[0]![1]).toBe('');
    });

    it('forwards DAC errors to passport via done(err)', async () => {
        const err = new Error('DB exploded');
        getUseridByProviderUID.mockRejectedValueOnce(err);
        const out = await callVerify({
            profile: { id: 'g-err', displayName: 'D', photos: [{ value: 'p' }] },
        });
        expect(out.err).toBe(err);
        expect(out.user).toBeUndefined();
    });
});
