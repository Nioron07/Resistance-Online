import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fastify, { type FastifyInstance } from 'fastify'
import { GET, get_opts } from '../../../../routes/api/users/_userid/index.js'

import * as db from '../../../../utils/db.js'

const mocked_user_profiles = {
    none: null,
    zero: {
        id: 0,
        username: 'the username',
        pfp: 'the link to the pfp image',
        bio: null,
        last_played: new Date()
    },
    one: {
        id: 0,
        username: 'the username',
        pfp: 'the link to the pfp image',
        bio: null,
        friends: [],
        count_games: 0,
        count_games_won: 0,
        game_metrics: {},
        overall_metrics: {},
        connections: {
            'idp0': 'the id',
            'idp2': 123456789
        },
        last_played: null,
        creation_date: new Date()
    },
    two: {
        id: 0,
        username: 'the username',
        pfp: 'the link to the pfp image',
        connections: {
            'idp0': {
                'key0': 'value0',
                'key1': 123456789
            }
        },
        friends: [],
        bio: null,
        last_played: new Date(),
        creation_date: new Date(),
        count_games: 0,
        count_games_won: 0,
        game_metrics: {},
        overall_metrics: {},
    }
};

// Mock the database utilities module before any imports
vi.mock('../../../../utils/db', () => ({
  healthCheck: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  transaction: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  getPool: vi.fn()
}));

describe('api/users/:userid Route', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        server = fastify();

        /**
         * @note Using :userid and not _userid. :param is fastify's default way of notating uri parameters.
         *  In constrast, _param is used for file based routing by @fastify/autoload.
         *  See the @fastify/autoload docs for more info: https://github.com/fastify/fastify-autoload#routeparams-optional.
         * - Joseph Habisohn 3/9/2026 
         */
        // Register the route handler directly instead of using fastify-router
        server.get('/api/users/:userid', get_opts, GET); //

        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    it('should 404 when the userid is not found in the db', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(mocked_user_profiles.none);
        
        const response = await server.inject({
            method: 'GET',
            url: '/api/users/9384759834'
        });
        
        expect(response.statusCode).toBe(404);
    });
    
    it('should return 200 and minimal information when the userid exists and verbosity is not passed', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(mocked_user_profiles.zero);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users/0' // Actual userid does not batter because we are mocking the db response
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The minimal information must include id, username, pfp, bio, last_played
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('username');
        expect(body).toHaveProperty('pfp');
        expect(body).toHaveProperty('bio');
        expect(body).toHaveProperty('last_played');

        // The minimal information should not include the following properties
        expect(body).not.toHaveProperty('connections');
        expect(body).not.toHaveProperty('friends');
        expect(body).not.toHaveProperty('creation_date');
        expect(body).not.toHaveProperty('count_games');
        expect(body).not.toHaveProperty('count_games_won');
        expect(body).not.toHaveProperty('gane_metrics');
        expect(body).not.toHaveProperty('overall_metrics');
    });

    it('should return 200 and minimal information when the userid exists and verbosity is set to 0', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(mocked_user_profiles.zero);
        
        const response = await server.inject({
            method: 'GET',
            url: '/api/users/4?verbosity=0' // This user should be the joebewon user
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The minimal information must include id, username, pfp, bio, last_played
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('username');
        expect(body).toHaveProperty('pfp');
        expect(body).toHaveProperty('bio');
        expect(body).toHaveProperty('last_played');

        // The minimal information should not include the following properties
        expect(body).not.toHaveProperty('connections');
        expect(body).not.toHaveProperty('friends');
        expect(body).not.toHaveProperty('creation_date');
        expect(body).not.toHaveProperty('count_games');
        expect(body).not.toHaveProperty('count_games_won');
        expect(body).not.toHaveProperty('gane_metrics');
        expect(body).not.toHaveProperty('overall_metrics');
    });

    it('should return 200 and profile information when the userid exists and verbosity is set to 1', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(mocked_user_profiles.one);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users/4?verbosity=1' // This user should be the joebewon user
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The profile information must include the following properties
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('pfp');
        expect(body).toHaveProperty('bio');
        expect(body).toHaveProperty('friends');
        expect(body).toHaveProperty('count_games');
        expect(body).toHaveProperty('count_games_won');
        expect(body).toHaveProperty('game_metrics');
        expect(body).toHaveProperty('overall_metrics');
        expect(body).toHaveProperty('connections');
        expect(body).toHaveProperty('last_played');
        expect(body).toHaveProperty('creation_date');

        for (const [key, value] of Object.entries(body.connections)) {
            expect(typeof key).toBe('string');
            expect(typeof value).toBeOneOf(['string', 'number']);
        }
    });

    it('should return 200 and all information when the userid exists and verbosity is set to 2', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce(mocked_user_profiles.two);
        const response = await server.inject({
            method: 'GET',
            url: '/api/users/4?verbosity=2' // This user should be the joebewon user
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The profile information must include the following properties
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('username');
        expect(body).toHaveProperty('pfp');
        expect(body).toHaveProperty('connections'); // No restriction any longer because it could now be anything based on the IdP
        expect(body).toHaveProperty('friends');
        expect(body).toHaveProperty('bio');
        expect(body).toHaveProperty('last_played');
        expect(body).toHaveProperty('creation_date');
        expect(body).toHaveProperty('count_games');
        expect(body).toHaveProperty('count_games_won');
        expect(body).toHaveProperty('game_metrics');
        expect(body).toHaveProperty('overall_metrics');
    });
});