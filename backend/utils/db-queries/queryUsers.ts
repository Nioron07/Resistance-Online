import { queryOne } from "../db.js";

export const userExistsQuery = `
SELECT
    id
FROM public.player_profiles
WHERE connections @> $1;
`;

/**
 * @async
 * 
 * Function that returns the profile of the user that has userid `@userid`
 * 
 * @param { string } provider `string` The provider to search with
 * @param { unknown } uid `unknown` The uid of the user with respect to the IdP `@provider`
 * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
 * @throws `Error` The caller of this function must handle the possibility of an error.
 */
export async function getUseridByProviderUID(provider: string, uid: unknown): Promise<number | undefined> {
    const identifier: Record<string, unknown> = {};
    identifier[provider] = {uid: uid};
    return (await queryOne<{ id: number }>(userExistsQuery, [
        identifier
    ]))?.id;
}

// -------------------------- -------------------------- Fully Migrated -------------------------- -------------------------- \\
// const getUserQueries = [
//     `
// SELECT
//     id, username, pfp, bio,
//     last_played
// FROM public.player_profiles
// WHERE id = $1;
// `,
//     `
// SELECT
//     p.id, p.username, p.pfp, p.bio, p.friends,
//     p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
//     jsonb_object_agg(e.key, e.value->'uid') AS connections,
//     p.last_played, p.creation_date
// FROM public.player_profiles p
// CROSS JOIN jsonb_each(p.connections) e
// WHERE id = $1
// GROUP BY id;
// `,
//     `
// SELECT
//     *
// FROM public.player_profiles
// WHERE id = $1;
// `
// ];

// /**
//  * @async
//  * 
//  * Function that returns the profile of the user that has userid `@userid`
//  * 
//  * @param { number } userid `number` The userid to look for.
//  * @param { ProfileVerbosity } verbosity `ProfileVerbosity` The verbosity level to return the profile at
//  * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
//  * @throws `Error` The caller of this function must handle the possibility of an error.
//  */
// export async function getUser(userid: number, verbosity: ProfileVerbosity): Promise<QueryResultRow | null> {
//     return await queryOne(getUserQueries[verbosity]!, [
//         userid
//     ]);
// }

// --------------- --------------- \\

// export const getUsersQueries = [
//     `
// SELECT
//     id, username, pfp, bio,
//     last_played
// FROM public.player_profiles
// WHERE id = ANY($1::bigint[]);
// `,
//     `
// SELECT
//     p.id, p.username, p.pfp, p.bio, p.friends,
//     p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
//     jsonb_object_agg(e.key, e.value->'uid') AS connections,
//     p.last_played, p.creation_date
// FROM public.player_profiles p
// CROSS JOIN jsonb_each(p.connections) e
// WHERE id = ANY($1::bigint[])
// GROUP BY id;
// `,
//     `
// SELECT
//     *
// FROM public.player_profiles
// WHERE id = ANY($1::bigint[]);
// `
// ]

// /**
//  * @async
//  * 
//  * Function that returns the profiles of the users in `@userids`
//  * 
//  * @param { number[] } userids `number[]` An array of userids to select
//  * @param { ProfileVerbosity } verbosity `ProfileVerbosity` The verbosity level to return the profiles at
//  * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
//  * @throws `Error` The caller of this function must handle the possibility of an error.
//  */
// export async function getUsers(userids: number[], verbosity: ProfileVerbosity): Promise<QueryResultRow[] | null> {
//     return await queryAll<QueryResultRow>(getUsersQueries[verbosity]!, [
//         userids
//     ]);
// }

// --------------- --------------- \\

// const getAllUsersQueries = [
//     `
// SELECT
//     id, username, pfp, bio,
//     last_played
// FROM public.player_profiles;
// `,
//     `
// SELECT
//     p.id, p.username, p.pfp, p.bio, p.friends,
//     p.count_games, p.count_games_won, p.game_metrics, p.overall_metrics,
//     jsonb_object_agg(e.key, e.value->'uid') AS connections,
//     p.last_played, p.creation_date
// FROM public.player_profiles p
// CROSS JOIN jsonb_each(p.connections) e
// GROUP BY id;
// `,
//     `
// SELECT
//     *
// FROM public.player_profiles;
// `
// ];

// /**
//  * @async
//  * 
//  * Function that returns the profiles of all users
//  *
//  * @param { ProfileVerbosity } verbosity `ProfileVerbosity` The verbosity level to return the profiles at
//  * @returns { Promise<QueryResultRow | null> } A promise containing the requested profile
//  * @throws `Error` The caller of this function must handle the possibility of an error.
//  */
// export async function getAllUsers(verbosity: ProfileVerbosity): Promise<QueryResultRow[] | null> {
//     return await queryAll<QueryResultRow>(getAllUsersQueries[verbosity]!);
// }

// --------------- --------------- \\

// const createUserQuery = `
// INSERT INTO
//     player_profiles (username, pfp, connections)
//     VALUES          ($1      , $2 , $3         )
// RETURNING id;
// `;

// /**
//  * 
//  * @param { string } username `string` The username of the player 
//  * @param { string } pfp `string` The uri to the profile picture.
//  * @param { string } provider `string` The name of the IdP used to SSO
//  * @param { { uid: unknown; } & Record<string, unknown> } provider_details `{ uid: unknown; } & Record<string, unknown>` An object describing the connector. Must at minimun contain the user's uid with respect to that IdP
//  * @returns { Promise<number> } A promise containing the userid of the new profile.
//  * @throws `Error` The caller of this function must handle the possibility of an error.
//  */
// export async function createUser(username: string, pfp: string, provider: string, provider_details: { uid: unknown; } & Record<string, unknown>): Promise<number> {
//     return (await transaction<QueryResult<{ id: number }>>((client: PoolClient) => {
//         const connection: Record<string, unknown> = {}
//         connection[provider] = provider_details
//         return client.query(createUserQuery, [
//             username,
//             pfp,
//             connection
//         ]);
//     })).rows[0]?.id!; // Creation will always have a id because public.player_profiles.id is a BigSerial
// }
