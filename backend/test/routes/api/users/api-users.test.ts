import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fastify, { type FastifyInstance } from 'fastify'
import { GET, get_opts } from '../../../../routes/api/users/index.js'

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

describe('api/users Route (returning all profiles)', () => {
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
        server.get('/api/users', get_opts, GET); //

        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    it('should 200 when no userids are found in the db (returning all profiles)', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce([]);
        
        const response = await server.inject({
            method: 'GET',
            url: '/api/users'
        });
        
        expect(response.statusCode).toBe(200);
    });
    
    it('should return 200 and minimal information when the userid exists and verbosity is not passed (returning all profiles)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero, mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and minimal information when the userid exists and verbosity is set to 0 (returning all profiles)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero, mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=0'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and profile information when the userid exists and verbosity is set to 1 (returning all profiles)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.one, mocked_user_profiles.one]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The profile information must include the following properties
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
            expect(profile).toHaveProperty('connections');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');

            for (const [key, value] of Object.entries(profile.connections)) {
                expect(typeof key).toBe('string');
                expect(typeof value).toBeOneOf(['string', 'number']);
            }
        }
    });

    it('should return 200 and all information when the userid exists and verbosity is set to 2 (returning all profiles)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.two, mocked_user_profiles.two]);
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=2'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The profile information must include the following properties
        for (const profile of body) {
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('connections'); // No restriction any longer because it could now be anything based on the IdP
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
        }
    });
});

describe('api/users Route (requesting one profile)', () => {
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
        server.get('/api/users', get_opts, GET); //

        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    it('should 200 when the userid is not found in the db (requesting one profile)', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce([]);
        
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?userids=9384759834&userids=9384759835'
        });
        
        expect(response.statusCode).toBe(200);
    });
    
    it('should return 200 and minimal information when the userid exists and verbosity is not passed (requesting one profile)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?userids=0'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and minimal information when the userid exists and verbosity is set to 0 (requesting one profile)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=0&userids=0'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and profile information when the userid exists and verbosity is set to 1 (requesting one profile)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.one]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=1&userids=0'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The profile information must include the following properties
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
            expect(profile).toHaveProperty('connections');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');

            for (const [key, value] of Object.entries(profile.connections)) {
                expect(typeof key).toBe('string');
                expect(typeof value).toBeOneOf(['string', 'number']);
            }
        }
    });

    it('should return 200 and all information when the userid exists and verbosity is set to 2 (requesting one profile)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.two]);
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=2&userids=0'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The profile information must include the following properties
        for (const profile of body) {
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('connections'); // No restriction any longer because it could now be anything based on the IdP
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
        }
    });
});

describe('api/users Route (requesting many profiles | commas)', () => {
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
        server.get('/api/users', get_opts, GET); //

        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    it('should 200 when none of userids are found in the db (requesting many profiles | commas)', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce([]);
        
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?userids=9384759834,9384759835'
        });
        
        expect(response.statusCode).toBe(200);
    });
    
    it('should return 200 and minimal information when at least one of the userids exists and verbosity is not passed (requesting many profiles | commas)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero, mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?userids=0,1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and minimal information when at least one of the userids exists and verbosity is set to 0 (requesting many profiles | commas)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero, mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=0&userids=0,1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and profile information when at least one of the userids exists and verbosity is set to 1 (requesting many profiles | commas)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.one, mocked_user_profiles.one]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=1&userids=0,1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The profile information must include the following properties
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
            expect(profile).toHaveProperty('connections');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');

            for (const [key, value] of Object.entries(profile.connections)) {
                expect(typeof key).toBe('string');
                expect(typeof value).toBeOneOf(['string', 'number']);
            }
        }
    });

    it('should return 200 and all information when at least one of the userids exists and verbosity is set to 2 (requesting many profiles | commas)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.two, mocked_user_profiles.two]);
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=2&userids=0,1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The profile information must include the following properties
        for (const profile of body) {
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('connections'); // No restriction any longer because it could now be anything based on the IdP
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
        }
    });
});

describe('api/users Route (requesting many profiles | array)', () => {
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
        server.get('/api/users', get_opts, GET); //

        await server.ready();
    });

    afterAll(async () => {
        await server.close();
    });

    it('should 200 when none of userids are found in the db (requesting many profiles | array)', async () => {
        vi.mocked(db.queryOne).mockResolvedValueOnce([]);
        
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?userids=9384759834&userids=9384759835'
        });
        
        expect(response.statusCode).toBe(200);
    });
    
    it('should return 200 and minimal information when at least one of the userids exists and verbosity is not passed (requesting many profiles | array)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero, mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?userids=0&userids=1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and minimal information when at least one of the userids exists and verbosity is set to 0 (requesting many profiles | array)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.zero, mocked_user_profiles.zero]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=0&userids=0&userids=1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The minimal information must include id, username, pfp, bio, last_played
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
    
            // The minimal information should not include the following properties
            expect(profile).not.toHaveProperty('connections');
            expect(profile).not.toHaveProperty('friends');
            expect(profile).not.toHaveProperty('creation_date');
            expect(profile).not.toHaveProperty('count_games');
            expect(profile).not.toHaveProperty('count_games_won');
            expect(profile).not.toHaveProperty('gane_metrics');
            expect(profile).not.toHaveProperty('overall_metrics');
        }
    });

    it('should return 200 and profile information when at least one of the userids exists and verbosity is set to 1 (requesting many profiles | array)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.one, mocked_user_profiles.one]);

        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=1&userids=0&userids=1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        for (const profile of body) {
            // The profile information must include the following properties
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
            expect(profile).toHaveProperty('connections');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');

            for (const [key, value] of Object.entries(profile.connections)) {
                expect(typeof key).toBe('string');
                expect(typeof value).toBeOneOf(['string', 'number']);
            }
        }
    });

    it('should return 200 and all information when at least one of the userids exists and verbosity is set to 2 (requesting many profiles | array)', async () => {
        vi.mocked(db.queryAll).mockResolvedValueOnce([mocked_user_profiles.two, mocked_user_profiles.two]);
        const response = await server.inject({
            method: 'GET',
            url: '/api/users?verbosity=2&userids=0&userids=1'
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();

        // The profile information must include the following properties
        for (const profile of body) {
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('username');
            expect(profile).toHaveProperty('pfp');
            expect(profile).toHaveProperty('connections'); // No restriction any longer because it could now be anything based on the IdP
            expect(profile).toHaveProperty('friends');
            expect(profile).toHaveProperty('bio');
            expect(profile).toHaveProperty('last_played');
            expect(profile).toHaveProperty('creation_date');
            expect(profile).toHaveProperty('count_games');
            expect(profile).toHaveProperty('count_games_won');
            expect(profile).toHaveProperty('game_metrics');
            expect(profile).toHaveProperty('overall_metrics');
        }
    });
});