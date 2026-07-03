import { PoolClient, QueryResult, QueryResultRow } from "pg";
import { ResistanceState } from "../../game/ResistanceState.js";
import * as db from "../db.js"
import { MissionCardRecord, MissionResult, RoleName, teamOf } from "../../game/types/GameTypes.js";
import { ProfileVerbosity } from "../../types/user_types.js";
import { queryAll, queryOne } from "../db.js";
import { metricsRowsFromState } from "../../game/metrics/stateToRows.js";
import { computeGamePoints } from "../../game/metrics/points.js";

/**
 * Build the per-player mission card record persisted in
 * `voting_rounds.mission_cards`. Returns null when no cards are present
 * (e.g., the round didn't go on a mission).
 */
function buildMissionCardsRecord(cards: MissionCardRecord[]): Record<string, 'success' | 'fail'> | null {
    const out: Record<string, 'success' | 'fail'> = {};
    for (const c of cards) {
        if (c.playerId === undefined) continue;
        out[String(c.playerId)] = c.card ? 'success' : 'fail';
    }
    return Object.keys(out).length === 0 ? null : out;
}

/**
 * @class
 * @abstract
 * 
 * Abstract Data Access Class (DAC) providing an abstraction layer for database operations.
 * 
 * This class serves as a centralized API for interacting with various database tables and game-specific functionalities.
 * When the `enable` flag is set to `false`, all lowest level database functions are disabled and return `null`.
 * Otherwise, functions do not return `null`.
 * 
 * @remarks
 * Top-level public attributes include:
 * - `enable`: A boolean flag to globally enable or disable database operations.
 * - `resistance`: Specialized API for accessing and manipulating game-related data, particularly for the Resistance game.
 * - `users`: API for accessing user-related database tables (@todo).
 * 
 * The `resistance` attribute is unique as it contains game-specific functions, while others provide general table access.
 */
export abstract class DAC {
    
    /**
     * @static
     * @property
     * 
     * Enable bit.
     * 
     * When false, all lowest level database functions return null and do not make any sql calls.
     * 
     * However, no database in function in `resistance` will ever return null when this property is set to true.
     */
    static enable: boolean = true;

    /**
     * @private
     * @function
     * 
     * Wrapper that checks if `DAC.enable` is false. Otherwise, returns whatever `@fn` returns,
     * 
     * @param fn `() => T` The funciton to wrap.
     * @returns `T | null`
     * - `T` returns whatever fn() returns
     * - `null` iff `DAC.enable === false`
     */
    private static run<T>(fn: () => T): T | null {
        if (DAC.enable) return fn();
        return null;
    };

    /**
     * @static
     * @property
     * 
     * Specialized API for accessing and manipulating Resistance game-related data.
     * 
     * Provides centralized database operations for the Resistance game. All operations respect the `enable` flag.
     * 
     * @remarks
     * Contains nested objects for different game entities:
     * - `games`: Game creation and player management for specific games
     * - `rounds: Round creation and management for specific rounds
     */
    static resistance = {
        /**
         * @property
         * 
         * API for game creation and player management in the Resistance game.
         * 
         * Provides database operations for the `public.games` table.
         * 
         * @remarks
         * Nested API structure:
         * - `createGame()`: Creates a new game and returns its ID
         * - `id(gameid)`: Returns the api for managing a specific game
         */
        games: {
            /**
             * @async
             * @function
             * 
             * Creates a new Resistance game in the database.
             * 
             * Initializes a new game entry in the `public.games` table and returns the generated game ID.
             * 
             * @returns `number | null` The gameid of the newly created game or null iff `DAC.enable == false`
             * @throws iff a database call throws
             */
            async create(): Promise<number | null> {
                return DAC.run(async () => {
                    return (await db.transaction<QueryResult<{ id: number }>>((client: PoolClient): Promise<QueryResult<{ id: number }>> => {
                        return client.query(DAC.queries.resistance.games.create);
                    })).rows[0]!.id;
                });
            },
            
            /**
             * @function
             * 
             * Returns a game-specific API for managing a Resistance game.
             * 
             * @param gameid `number`  The ID of the game to manage.
             * @returns An object providing APIs for player management, settings updates, and game completion.
             */
            id(gameid: number) {
                return {
                    
                    /**
                     * @function
                     * 
                     * Returns a player-specific API for managing a user in a Resistance game.
                     * 
                     * @param userid `number` The ID of the user to manage.
                     * @returns An object providing APIs for adding, updating, and removing the player from the game.
                     */
                    playerId(userid: number) {
                        return {
                            /**
                             * @async
                             * @function
                             * 
                             * Adds a player to a Resistance game.
                             * 
                             * Adds the user to the game's player list without assigning a role.
                             * Does not throw if the user already exists in the game.
                             * 
                             * @returns `'exists' | 'added' | null`
                             * - `'exists'`: if the user is already in the game, player is not added in this case
                             * - `'added'`: if the user was successfully added
                             * - `null` iff `DAC.enable === false`
                             * @throws iff a database call throws
                             */
                            async add(): Promise<'exists' | 'added' | null> {
                                return DAC.run(async () => {
                                    return (await db.transaction(async (client: PoolClient): Promise<QueryResult<QueryResultRow>> => {
                                        /**
                                         * @note Watch the types on `userid`. The change depending on the query.
                                         *      `as` syntax is not a mistake. It is being used as a flag to explicitly show future readers what type it needs to be for a given query.
                                         *      If you any type casting on userid from where they are now, the query will break.
                                         * - Joseph Habisohn 4/23/2026
                                         */

                                        const exists: boolean = (await client.query<{ exists: boolean }>(
                                            DAC.queries.resistance.games.id.playerId.exists, [gameid, userid.toString() as string]
                                        )).rows[0]!.exists;

                                        // If the user exists, silently fail
                                        if (exists) {
                                            return undefined as unknown as QueryResult<QueryResultRow>; // Typescript typing is a truly mysterious thing
                                        }

                                        await client.query(DAC.queries.resistance.games.id.playerId.update_last_played, [userid as number]);
                                        return client.query(DAC.queries.resistance.games.id.playerId.add_update, [gameid, { [userid]: null }]);
                                    })) === undefined ? 'exists' : 'added';
                                });
                            },
                            
                            /**
                             * @async
                             * @function
                             * 
                             * Updates a player's role in a Resistance game.
                             * 
                             * Assigns or replaces a role for the user in the game. If the user does not exist,
                             * they are added with the specified role. If the user already has a role, it is silently replaced.
                             * 
                             * @param role `RoleName` The role to assign to the player.
                             * @returns `'updated' | null`
                             * - `'updated'`: on successful role assignment or replacement
                             * - `null` iff `DAC.enable === false`
                             * @throws iff a database call throws
                             */
                            async update(role: RoleName): Promise<'updated' | null> {
                                return DAC.run<Promise<'updated'>>(async () => {
                                    // Single statement — no transaction needed
                                    // (this runs on the game hot path).
                                    await db.query(DAC.queries.resistance.games.id.playerId.add_update, [gameid, {[userid]: role}]);

                                    return 'updated';
                                })
                            },
                            
                            /**
                             * @async
                             * @function
                             * 
                             * Removes a player from a Resistance game.
                             * 
                             * Removes the user from the game's player list. Does not throw if the user does not exist.
                             * 
                             * @returns `'removed' | null`
                             * - `'removed'`: on successful removal (even if user did not exist)
                             * - `null` iff `DAC.enable === false`
                             * @throws iff a database call throws
                             */
                            async remove(): Promise<'removed' | null> {
                                return DAC.run<Promise<'removed'>>(async () => {
                                    // Single statement — no transaction needed.
                                    await db.query(DAC.queries.resistance.games.id.playerId.remove, [gameid, userid.toString() as string]);

                                    return 'removed'
                                });
                            }
                        }
                    },
                    
                    /**
                     * @async
                     * @function
                     * 
                     * Updates the configuration settings for a Resistance game.
                     * 
                     * Merges the provided configuration object with existing game settings in the database.
                     * Does not throw if the game does not exist
                     * 
                     * @param config `object` Configuration object to merge with existing settings.
                     * @returns `'updated' | 'no game' | null`
                     * - `'updated'`: on success
                     * - `'no game'` when the game does not exist
                     * - `null` iff `DAC.enable === false`
                     * @throws iff a database call throws
                     */
                    async updateSettings(config: object): Promise<'updated' | 'no game' | null> {
                        return DAC.run<Promise<'updated' | 'no game'>>(async () => {
                            const result = await db.transaction((client: PoolClient): Promise<QueryResult<QueryResultRow>> => {
                                return client.query(DAC.queries.resistance.games.id.updateSettings, [gameid, structuredClone(config)]);
                            });
    
                            return result.rowCount != 0 ? 'updated' : 'no game';
                        });
                    },

                    async start(): Promise<'started' | null> {
                        return DAC.run<Promise<'started'>>(async () => {
                            await db.transaction(async (client: PoolClient) => {
                                // Must be awaited: callers rely on start()
                                // resolving only after the row is actually
                                // committed (see LobbyPlugin game:start).
                                return await client.query(DAC.queries.resistance.games.id.start, [gameid]);
                            });
                            return 'started';
                        });
                    },

                    /**
                     * @async
                     * @function
                     * 
                     * Finalizes a Resistance game and updates player statistics.
                     * 
                     * Records the game outcome in the `games` table and updates each player's profile
                     * with their individual game results and statistics. Does not throw if the game does not exist.
                     * 
                     * @param state `ResistanceState` The final game state containing mission results, roles, and players.
                     * @param reason `string` The reason for game completion.
                     * @returns `'ended' | null`
                     * - `'ended'`: on successful completion
                     * - `null` iff `DAC.enable === false`
                     * @throws iff a database call throws
                     */
                    async end(state: ResistanceState, reason: string): Promise<'ended' | null> {
                        return DAC.run<Promise<'ended'>>(async () => {
                            // Snapshot synchronously, before any await, so the
                                // values we persist can't drift if ResistanceCore
                                // mutates state while the transaction runs.
                                // metricsRowsFromState reads the live `players`
                                // Map; must run BEFORE structuredClone strips it.
                                const pointsRows = metricsRowsFromState(state, gameid);
                                const _state: ResistanceState = structuredClone(state);
                                const winningTeam: 'spy' | 'resistance' | null =
                                    _state.endWinner === 'spies' ? 'spy'
                                    : _state.endWinner === 'resistance' ? 'resistance'
                                    : null;
                                // structuredClone drops the Map prototype, but
                                // (depending on the runtime) the entries survive
                                // as a plain object or get rebuilt as a Map. Read
                                // roles via the original state — it's safe because
                                // we haven't yielded yet.
                                const playerRoles = new Map<number, RoleName | undefined>();
                                for (const playerId of _state.seatOrder) {
                                    playerRoles.set(playerId, state.players.get(playerId)?.role);
                                }

                                await db.transaction(async (client: PoolClient): Promise<QueryResult<QueryResultRow>> => {
                                    const date: string = new Date().toISOString()
                                    const queries: Promise<QueryResult<QueryResultRow>>[] = [];

                                    queries.push(client.query(DAC.queries.resistance.games.id.end.gameRow, [
                                        gameid,
                                        _state.count_rounds - _state.missions.length,
                                        _state.missions.map((e: MissionResult) => e.success),
                                        _state.endWinner === "resistance",
                                        reason,
                                        date
                                    ]));

                                    for (const playerId of _state.seatOrder) {
                                        const role = playerRoles.get(playerId);
                                        const player_won = winningTeam !== null
                                            && role !== undefined
                                            && winningTeam === teamOf(role);

                                        // Lifetime counters from the whitepaper's
                                        // raw per-player metadata: losses, per-role
                                        // counts, times as leader / on a mission /
                                        // selected for a team. Accumulated
                                        // additively into overall_metrics.
                                        const userid = String(playerId);
                                        let timesLeader = 0;
                                        let timesSelectedForTeam = 0;
                                        let timesOnMission = 0;
                                        for (const row of pointsRows) {
                                            if (String(row.leader_userid) === userid) timesLeader++;
                                            if ((row.mission_participent_userids ?? []).map(String).includes(userid)) {
                                                timesSelectedForTeam++;
                                                if (row.vote_status === true) timesOnMission++;
                                            }
                                        }
                                        const increments: Record<string, number> = {
                                            timesLeader,
                                            timesSelectedForTeam,
                                            timesOnMission,
                                        };
                                        if (winningTeam !== null && !player_won) increments.losses = 1;
                                        if (role !== undefined) increments[`role_${role}`] = 1;

                                        queries.push(client.query(DAC.queries.resistance.games.id.end.playerProfile, [
                                            playerId,
                                            date,
                                            player_won ? 1 : 0,
                                            { [gameid]: player_won },
                                            increments,
                                        ]));
                                    }

                                    // Per-(game, player) point totals for the
                                    // R/S/P-Index pipeline. Skipped entirely if
                                    // the game ended in a tie/null winner —
                                    // partial data shouldn't pollute the index.
                                    if (winningTeam !== null) {
                                        for (const playerId of _state.seatOrder) {
                                            const result = computeGamePoints(String(playerId), pointsRows);
                                            if (!result) continue;
                                            queries.push(client.query(DAC.queries.resistance.games.id.end.playerGameMetrics, [
                                                gameid,
                                                playerId,
                                                result.side,
                                                result.points,
                                                result.breakdown,
                                                result.catalogVersion,
                                            ]));
                                        }
                                    }

                                    // Wait for everything inside the transaction so
                                    // failures actually surface (and roll back)
                                    // instead of being silently dropped.
                                    await Promise.all(queries);
                                    return undefined as unknown as QueryResult<QueryResultRow>;
                                });
                            
                            return 'ended';
                        });
                    }
                }
            }
        },

        /**
         * @property
         * 
         * API for round creation and management in the Resistance game.
         * 
         * Provides database operations for the `public.voting_rounds` table.
         * 
         * @remarks
         * Nested API structure:
         * - `createRound(gameid, state)`: Creates a new round and returns its ID
         * - `id(roundid)`: Returns the api for managing a specific round (@todo)
         */
        rounds: {
            /**
             * @async
             * @function
             * 
             * Creates a new voting round for a Resistance game.
             * 
             * Initializes a new round entry in the `public.voting_rounds` table with mission nomination and voting data, returning the generated round ID.
             * 
             * @param gameid `number` The ID of the game the round belongs to.
             * @param state `ResistanceState` The current game state containing pending nominations and votes.
             * @returns `number | null` The round ID of the newly created round, or null iff `DAC.enable === false`
             * @throws iff a database call throws
             */
            async create(gameid: number, state: ResistanceState): Promise<number | null> {
                // Clone synchronously before any awaits so the snapshot is taken
                // at call time. db.transaction's first await (pool.connect) yields
                // back to the caller; if the clone happened inside the transaction
                // callback it would race with post-DAC state mutations in
                // ResistanceCore (pendingNominations clear, leader rotation, etc.).
                const state_copy: ResistanceState = structuredClone(state);
                // Per-player mission cards for the just-played mission (if any).
                // Only attached when the last nomination was approved AND a
                // mission was actually played; otherwise null.
                const lastMission = state_copy.missions.at(-1);
                const lastNomLocal = state_copy.pendingNominations.at(-1);
                const missionCards: Record<string, 'success' | 'fail'> | null =
                    (lastNomLocal?.outcome === true && lastMission)
                        ? buildMissionCardsRecord(lastMission.cards)
                        : null;
                return DAC.run(async () => {
                    const lastNomination = state_copy.pendingNominations.at(-1);

                    // Single INSERT — a transaction wrapper here just adds
                    // BEGIN/COMMIT round-trips on every resolved round.
                    return (await db.query<{ id: number }>(DAC.queries.resistance.rounds.create, [
                            gameid,                                                                     // voting_rounds.game_id
                            state_copy.leaderId,                                                        // voting_rounds.leader_userid
                            lastNomination?.proposedTeam,                                               // voting_rounds.mission_participent_userids
                            lastNomination?.numberOfSpies,                                              // voting_rounds.count_spies_nominated
                            null,                                                                       // voting_rounds.plot_cards_stuff
                            lastNomination?.votes,                                                      // voting_rounds.vote_poll
                            lastNomination?.outcome,                                                    // voting_rounds.vote_status
                            !lastNomination?.outcome ? null : state_copy.missions.at(-1)?.success,      // voting_rounds.mission_status
                            lastNomination?.outcome === undefined ? {} : state_copy.pendingVotes,       // voting_rounds.mission_details
                            state_copy.pendingSuspicions,                                               // voting_rounds.suspicions
                            missionCards                                                                // voting_rounds.mission_cards
                    ])).rows[0]!.id;
                });
            },
            
            /**
             * @todo
             * @function
             * 
             * Returns a round-specific API for managing a Resistance voting round.
             * 
             * @param roundid `number` The ID of the round to manage.
             * @returns An object providing APIs for managing round data and voting information.
             */
            id(_roundid: number) {
                return {
    
                }
            }
        }
    };

    /**
     * @todo
     * @static
     * @property
     * 
     * API for accessing and manipulating user-related data.
     * 
     * Provides centralized database operations for user tables. All operations respect the `enable` flag.
     */
    static users = {
        /**
         * @async
         * @function
         * 
         * Function that returns the profiles of all users, paginated.
         *
         * @param { ProfileVerbosity } verbosity `ProfileVerbosity` The verbosity level to return the profiles at
         * @param { number } limit  Max rows returned (caller is expected to clamp).
         * @param { number } offset Rows to skip.
         * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
         * @throws `Error` The caller of this function must handle the possibility of an error.
         */
        async get(verbosity: ProfileVerbosity, limit: number = 100, offset: number = 0): Promise<QueryResultRow[] | null> {
            return await db.queryAll<QueryResultRow>(DAC.queries.users.get[verbosity]!, [limit, offset]);
        },

        /**
         * @async
         * @function
         *
         * Case-insensitive substring search on `username`. Returns the same
         * column set as verbosity-0 — minimal info sufficient for a search
         * results list. Results are ordered by relevance (exact match first,
         * then prefix, then substring) and most-recently-played within each
         * relevance tier.
         *
         * @param { string } q       The substring to match.
         * @param { number } limit   Max rows to return (caller is expected to clamp).
         * @returns Promise of an array of matching profiles. Empty when no rows match.
         * @throws iff the underlying query throws.
         */
        async search(q: string, limit: number): Promise<QueryResultRow[]> {
            const like = `%${q}%`;
            const prefix = `${q}%`;
            return await db.queryAll<QueryResultRow>(DAC.queries.users.search, [like, q, prefix, limit]);
        },

        /**
         * @async
         * @function
         * 
         * Creates a new user. Must manually check existance before hand.
         * 
         * @param { string } username `string` The username of the player 
         * @param { string } pfp `string` The uri to the profile picture.
         * @param { string } provider `string` The name of the IdP used to SSO
         * @param { { uid: unknown; } & Record<string, unknown> } provider_details `{ uid: unknown; } & Record<string, unknown>` An object describing the connector. Must at minimun contain the user's uid with respect to that IdP
         * @returns { Promise<number> } A promise containing the userid of the new profile.
         * @throws `Error` The caller of this function must handle the possibility of an error.
         */
        async create(username: string, pfp: string, provider: string, provider_details: { uid: unknown; } & Record<string, unknown>): Promise<number> {
            return (await db.transaction<QueryResult<{ id: number }>>(async (client: PoolClient) => {
                const connection: Record<string, unknown> = {}
                connection[provider] = provider_details
                return client.query(DAC.queries.users.create, [
                    username,
                    pfp,
                    connection
                ]);
            })).rows[0]!.id; // Creation will always have a id because public.player_profiles.id is a BigSerial
        },

        id(userid: number) {
            return {
                /**
                 * @async
                 * @function
                 *
                 * Function that returns the profile of the user that has userid `@userid`
                 *
                 * @param { number } userid `number` The userid to look for. Recieved from this functions parent `id()`.
                 * @param { ProfileVerbosity } verbosity `ProfileVerbosity` The verbosity level to return the profile at
                 * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
                 * @throws `Error` The caller of this function must handle the possibility of an error.
                 */
                async get(verbosity: ProfileVerbosity): Promise<QueryResultRow | null> {
                    return await db.queryOne(DAC.queries.users.id.get[verbosity]!, [
                        userid
                    ]);
                },

                /**
                 * @async
                 * @function
                 *
                 * Set the username (and flip username_set=TRUE) for the
                 * authenticated user, after they have confirmed via the
                 * username-signup flow.
                 *
                 * @returns `'taken' | 'updated' | null`
                 *   - `'taken'` if some other user already has this username (case-insensitive)
                 *   - `'updated'` on success; the row is returned via the second tuple field
                 *   - `null` iff `DAC.enable === false`
                 */
                async setUsername(username: string): Promise<['taken'] | ['updated', QueryResultRow] | null> {
                    return DAC.run<Promise<['taken'] | ['updated', QueryResultRow]>>(async () => {
                        const client = await db.getClient();
                        try {
                            await client.query('BEGIN');
                            const taken = await client.query<{ id: number }>(
                                DAC.queries.users.usernameTakenBy,
                                [username, userid],
                            );
                            if (taken.rowCount && taken.rowCount > 0) {
                                await client.query('ROLLBACK');
                                return ['taken'];
                            }
                            const result = await client.query<QueryResultRow>(
                                DAC.queries.users.updateUsername,
                                [userid, username],
                            );
                            await client.query('COMMIT');
                            return ['updated', result.rows[0]!];
                        } catch (err) {
                            await client.query('ROLLBACK');
                            throw err;
                        } finally {
                            client.release();
                        }
                    });
                }
            }
        },

        ids(userids: number[]) {
            return {
                /**
                 * @async
                 * @function
                 * 
                 * Function that returns the profiles of the users in `@userids`
                 * 
                 * @param { number[] } userids `number[]` An array of userids to select. Recieved from this functions parent `ids()`.
                 * @param { ProfileVerbosity } verbosity `ProfileVerbosity` The verbosity level to return the profiles at
                 * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
                 * @throws `Error` The caller of this function must handle the possibility of an error.
                 */
                async get(verbosity: ProfileVerbosity): Promise<QueryResultRow[] | null> {
                    return await queryAll<QueryResultRow>(DAC.queries.users.id.get[verbosity]!, [
                        userids
                    ]);
                }
            }
        },

        provider(provider: string) {
            return {
                uid(uid: unknown) {
                    return {
                        /**
                         * @async
                         * @function
                         * 
                         * Function that returns the userid of the user that has provider `@provider` and provider uid `@uid`
                         * 
                         * @param { string } provider `string` The provider to search with. . Recieved from this functions grandparent `provider()`.
                         * @param { unknown } uid `unknown` The uid of the user with respect to the IdP `@provider`. Recieved from this functions parent `uid()`.
                         * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
                         * @throws `Error` The caller of this function must handle the possibility of an error.
                         */
                        async getUseridByProviderUID(): Promise<number | undefined> {
                            const identifier: Record<string, unknown> = {};
                            identifier[provider] = {uid: uid};
                            return (await queryOne<{ id: number }>(DAC.queries.users.provider.uid.getId, [
                                identifier
                            ]))?.id;
                        }
                    }
                }
            }
        }
    };

    /**
     * @note I swear to goodness gracious if this gets linted im gonna do something bad
     * - Joseph Habisohn 4/19/2026
     */
    private static queries = {
        resistance: {
            games: {
                create: `INSERT INTO games
                                DEFAULT VALUES
                            RETURNING id;`,
    
                id: {
                    playerId: {
                        exists: `SELECT
                                    players ? $2 as exists
                                FROM games WHERE id = $1;`,

                        update_last_played: `UPDATE player_profiles SET
                                                last_played = NOW()
                                            WHERE id = $1;`,
    
                        add_update: `UPDATE games SET
                                        players = players || $2::jsonb
                                    WHERE id = $1;`,
    
                        remove: `UPDATE games SET
                                    players = players - $2
                                WHERE id = $1;`
                    },
    
                    updateSettings: `UPDATE games SET
                                        settings = settings || $2::jsonb
                                    WHERE id = $1;`,
    
                    start: `UPDATE games SET
                                    start_timestamp = NOW()
                                WHERE id = $1;`,

                    end: {
                        gameRow: `UPDATE games SET
                                    count_failed_votes = $2,
                                    mission_statuses = $3,
                                    resistance_win = $4,
                                    outcome_type = $5,
                                    end_timestamp = $6::timestamptz
                                WHERE id = $1;`,
    
                        /**
                         * $5 is a jsonb map of counter increments (e.g.
                         * {"timesLeader": 2, "role_spy": 1, "losses": 1}).
                         * Each key is added to the existing counter in
                         * overall_metrics; keys not present in $5 are left
                         * untouched.
                         */
                        playerProfile: `UPDATE player_profiles SET
                                            count_games = count_games + 1,
                                            last_online = $2::timestamptz,
                                            count_games_won = count_games_won + (1 * $3),
                                            game_metrics = game_metrics || $4::jsonb,
                                            overall_metrics = COALESCE(overall_metrics, '{}'::jsonb) || (
                                                SELECT COALESCE(
                                                    jsonb_object_agg(
                                                        t.k,
                                                        to_jsonb(COALESCE((COALESCE(overall_metrics, '{}'::jsonb)->>t.k)::numeric, 0) + t.v::numeric)
                                                    ),
                                                    '{}'::jsonb
                                                )
                                                FROM jsonb_each_text($5::jsonb) AS t(k, v)
                                            )
                                        WHERE id = $1;`,

                        playerGameMetrics: `INSERT INTO player_game_metrics
                                                (game_id, user_id, side, points, breakdown, catalog_version, computed_at)
                                            VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
                                            ON CONFLICT (game_id, user_id) DO UPDATE SET
                                                side             = EXCLUDED.side,
                                                points           = EXCLUDED.points,
                                                breakdown        = EXCLUDED.breakdown,
                                                catalog_version  = EXCLUDED.catalog_version,
                                                computed_at      = NOW();`
                    }
                }
            },
            rounds: {
                create: `INSERT INTO
                                voting_rounds (game_id, leader_userid, mission_participent_userids, count_spies_nominated, plot_cards_stuff, vote_poll, vote_status, mission_status, mission_details, suspicions, mission_cards)
                                VALUES        ($1     , $2           , $3                         , $4                   , $5              , $6       , $7         , $8            , $9             , $10       , $11::jsonb)
                            RETURNING id;`,
                id: {
    
                }
            }
        },

        users: {
            /**
             * @note All verbosities paginate ($1 = LIMIT, $2 = OFFSET) and
             * none of them ever return the raw `connections` JSONB — it
             * contains the full OAuth/Steam provider profile (PII). Only the
             * provider→uid mapping is exposed, and only at verbosity >= 1.
             * The uid map is built with a scalar subquery (not CROSS JOIN)
             * so profiles with no connections aren't silently dropped.
             */
            get: [
                `SELECT
                    id, username, pfp, bio,
                    last_played
                FROM public.player_profiles
                ORDER BY id
                LIMIT $1 OFFSET $2;
                `,
                `SELECT
                    p.id, p.username, p.pfp, p.bio, p.friends,
                    p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
                    (SELECT COALESCE(jsonb_object_agg(e.key, e.value->'uid'), '{}'::jsonb)
                       FROM jsonb_each(p.connections) e) AS connections,
                    p.last_played, p.creation_date
                FROM public.player_profiles p
                ORDER BY p.id
                LIMIT $1 OFFSET $2;
                `,
                `SELECT
                    p.id, p.username, p.pfp, p.bio, p.friends,
                    p.username_set,
                    p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
                    (SELECT COALESCE(jsonb_object_agg(e.key, e.value->'uid'), '{}'::jsonb)
                       FROM jsonb_each(p.connections) e) AS connections,
                    p.last_played, p.creation_date
                FROM public.player_profiles p
                ORDER BY p.id
                LIMIT $1 OFFSET $2;
                `
            ],
            create: `INSERT INTO
                        player_profiles (username, pfp, connections)
                        VALUES          ($1      , $2 , $3         )
                    RETURNING id;`,

            /**
             * Substring search on username. Boost ranking: exact-match (0),
             * prefix (1), then plain substring (2). Tiebreak by recency.
             *
             * $1 = '%q%' (substring), $2 = q (exact), $3 = 'q%' (prefix),
             * $4 = limit.
             */
            search: `SELECT id, username, pfp, bio, last_played
                       FROM public.player_profiles
                      WHERE username ILIKE $1
                      ORDER BY
                        CASE WHEN LOWER(username) = LOWER($2) THEN 0
                             WHEN username ILIKE $3            THEN 1
                             ELSE                                   2 END,
                        last_played DESC NULLS LAST,
                        id ASC
                      LIMIT $4;`,
            id: {
                get: [
                    `SELECT
                        id, username, pfp, bio,
                        username_set,
                        last_played
                    FROM public.player_profiles
                    WHERE id = $1;
                    `,
                    `SELECT
                        p.id, p.username, p.pfp, p.bio, p.friends,
                        p.username_set,
                        p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
                        (SELECT COALESCE(jsonb_object_agg(e.key, e.value->'uid'), '{}'::jsonb)
                           FROM jsonb_each(p.connections) e) AS connections,
                        p.last_played, p.creation_date
                    FROM public.player_profiles p
                    WHERE id = $1;
                    `,
                    `SELECT
                        p.id, p.username, p.pfp, p.bio, p.friends,
                        p.username_set,
                        p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
                        (SELECT COALESCE(jsonb_object_agg(e.key, e.value->'uid'), '{}'::jsonb)
                           FROM jsonb_each(p.connections) e) AS connections,
                        p.last_played, p.creation_date
                    FROM public.player_profiles p
                    WHERE id = $1;
                    `
                ]
            },

            /**
             * Sets the username AND flips username_set=TRUE so the frontend
             * stops prompting. Returns the new (medium-verbosity) profile.
             */
            updateUsername: `UPDATE public.player_profiles
                                SET username = $2, username_set = TRUE
                            WHERE id = $1
                            RETURNING id, username, pfp, bio, username_set, count_games, count_games_won;`,

            /**
             * Returns 1 row if some other player already has this username,
             * 0 rows otherwise. Used by the username-set endpoint to enforce
             * uniqueness without a hard SQL constraint.
             */
            usernameTakenBy: `SELECT id FROM public.player_profiles
                                WHERE LOWER(username) = LOWER($1) AND id <> $2
                                LIMIT 1;`,

            ids: [
                `SELECT
                    id, username, pfp, bio,
                    last_played
                FROM public.player_profiles
                WHERE id = ANY($1::bigint[]);
                `,
                `SELECT
                    p.id, p.username, p.pfp, p.bio, p.friends,
                    p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
                    (SELECT COALESCE(jsonb_object_agg(e.key, e.value->'uid'), '{}'::jsonb)
                       FROM jsonb_each(p.connections) e) AS connections,
                    p.last_played, p.creation_date
                FROM public.player_profiles p
                WHERE id = ANY($1::bigint[]);
                `,
                `SELECT
                    p.id, p.username, p.pfp, p.bio, p.friends,
                    p.username_set,
                    p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
                    (SELECT COALESCE(jsonb_object_agg(e.key, e.value->'uid'), '{}'::jsonb)
                       FROM jsonb_each(p.connections) e) AS connections,
                    p.last_played, p.creation_date
                FROM public.player_profiles p
                WHERE id = ANY($1::bigint[]);
                `
            ],

            provider: {
                uid: {
                    getId: `SELECT
                                id
                            FROM public.player_profiles
                            WHERE connections @> $1;`
                }
            }
        }
    };
}

/** Docstrings written with the assistance of an LLM */