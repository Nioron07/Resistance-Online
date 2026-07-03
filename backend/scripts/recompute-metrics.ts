import 'dotenv/config'
import { queryAll, query, closePool } from '../utils/db.js'
import { computeGamePoints } from '../game/metrics/points.js'
import type { MetricsRow } from '../routes/api/users/_userid/metrics/index.js'

/**
 * Rebuilds `player_game_metrics` from the raw `voting_rounds` + `games`
 * data using the current action-point catalog.
 *
 * Run this after changing point values in `game/metrics/actionPoints.ts`
 * (bump CATALOG_VERSION there first) so historical games are re-scored
 * under the new catalog and the R/S/P indices stay comparable.
 *
 * Usage:
 *   npm run recompute-metrics             # all finished games
 *   npm run recompute-metrics -- 123 456  # only these game ids
 */

const GAMES_SQL = `
    SELECT id, players
    FROM games
    WHERE resistance_win IS NOT NULL
      AND ($1::bigint[] IS NULL OR id = ANY($1::bigint[]))
    ORDER BY id;`;

const ROUNDS_SQL = `
    SELECT
        vr.game_id,
        vr.id AS round_id,
        vr.leader_userid,
        vr.mission_participent_userids,
        vr.count_spies_nominated,
        vr.vote_status,
        vr.mission_status,
        vr.suspicions,
        vr.vote_poll,
        vr.mission_cards,
        g.players,
        g.resistance_win,
        ROW_NUMBER() OVER (PARTITION BY vr.game_id ORDER BY vr.id ASC) - 1 AS round_index_in_game
    FROM voting_rounds vr
    JOIN games g ON g.id = vr.game_id
    WHERE vr.game_id = $1
    ORDER BY vr.id;`;

const UPSERT_SQL = `
    INSERT INTO player_game_metrics
        (game_id, user_id, side, points, breakdown, catalog_version, computed_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
    ON CONFLICT (game_id, user_id) DO UPDATE SET
        side             = EXCLUDED.side,
        points           = EXCLUDED.points,
        breakdown        = EXCLUDED.breakdown,
        catalog_version  = EXCLUDED.catalog_version,
        computed_at      = NOW();`;

async function main() {
    const idArgs = process.argv.slice(2).map(Number).filter(n => Number.isInteger(n) && n > 0);
    const gameFilter = idArgs.length > 0 ? idArgs : null;

    const games = await queryAll<{ id: number, players: Record<string, string | null> }>(GAMES_SQL, [gameFilter]);
    console.log(`Recomputing metrics for ${games.length} finished game(s)…`);

    let upserts = 0;
    let skipped = 0;

    for (const game of games) {
        const rows = await queryAll<MetricsRow>(ROUNDS_SQL, [game.id]);
        if (rows.length === 0) {
            console.warn(`  game ${game.id}: no voting_rounds rows — skipped`);
            skipped++;
            continue;
        }

        for (const userid of Object.keys(game.players ?? {})) {
            const result = computeGamePoints(userid, rows);
            if (!result) {
                skipped++;
                continue;
            }
            await query(UPSERT_SQL, [
                game.id,
                Number(userid),
                result.side,
                result.points,
                result.breakdown,
                result.catalogVersion,
            ]);
            upserts++;
        }
    }

    console.log(`Done. ${upserts} player-game rows upserted, ${skipped} skipped.`);
}

main()
    .catch(err => {
        console.error('recompute-metrics failed:', err);
        process.exitCode = 1;
    })
    .finally(() => closePool());
