import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { POST, post_opts } from '../../../routes/auth/me/username/index.js';
import { DAC } from '../../../utils/db-queries/DataAccessClass.js';

describe('POST /auth/me/username', () => {
    let server: FastifyInstance;
    let setUsernameSpy: ReturnType<typeof vi.fn>;

    beforeAll(async () => {
        server = fastify();

        // Inject a fake auth state via a preHandler. Tests flip
        // `(server as any).__authed` to control the result.
        server.addHook('preHandler', (req, _rep, done) => {
            const authed = (server as unknown as { __authed: boolean }).__authed;
            (req as unknown as { isUnauthenticated: () => boolean }).isUnauthenticated = () => !authed;
            (req as unknown as { user: { userid: number } }).user = { userid: 7 };
            done();
        });

        // Stub the DAC method we depend on. The strict typing of setUsername
        // doesn't matter to the routing layer — it just forwards the result.
        setUsernameSpy = vi.fn();
        DAC.users.id = ((_id: number) => ({
            get: vi.fn(),
            setUsername: setUsernameSpy,
        })) as unknown as typeof DAC.users.id;

        server.post('/auth/me/username', post_opts, POST);
        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        (server as unknown as { __authed: boolean }).__authed = true;
    });

    it('401s if not authenticated', async () => {
        (server as unknown as { __authed: boolean }).__authed = false;
        const res = await server.inject({
            method: 'POST',
            url: '/auth/me/username',
            payload: { username: 'someone' },
        });
        expect(res.statusCode).toBe(401);
    });

    it('400s on a malformed username', async () => {
        const res = await server.inject({
            method: 'POST',
            url: '/auth/me/username',
            payload: { username: 'a b' }, // contains space
        });
        expect(res.statusCode).toBe(400);
    });

    it('409s when the username is already taken', async () => {
        setUsernameSpy.mockResolvedValueOnce(['taken']);
        const res = await server.inject({
            method: 'POST',
            url: '/auth/me/username',
            payload: { username: 'someone' },
        });
        expect(res.statusCode).toBe(409);
    });

    it('returns the updated profile on success', async () => {
        setUsernameSpy.mockResolvedValueOnce(['updated', { id: 7, username: 'newname', username_set: true }]);
        const res = await server.inject({
            method: 'POST',
            url: '/auth/me/username',
            payload: { username: 'newname' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ id: 7, username: 'newname', username_set: true });
    });

    it('503s when DAC is disabled', async () => {
        setUsernameSpy.mockResolvedValueOnce(null);
        const res = await server.inject({
            method: 'POST',
            url: '/auth/me/username',
            payload: { username: 'newname' },
        });
        expect(res.statusCode).toBe(503);
    });
});
