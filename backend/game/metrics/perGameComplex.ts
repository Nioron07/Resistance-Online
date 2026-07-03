import type { MetricsRow } from '../../routes/api/users/_userid/metrics/index.js';
import { SPY_ROLES } from '../../routes/api/users/_userid/metrics/index.js';

/**
 * Per-game versions of the lifetime "complex" metrics from the whitepaper.
 *
 *   - RoS_G  Game Rate of Sherlock — resistance only.
 *            How well this player picked spies during this game's
 *            suspicion phases.
 *   - RoI_G  Game Rate of Illusion — spy only.
 *            How well this player flew under the radar during this game.
 *
 * Notes:
 *  - RoS_L / RoP_L / RoI_L / RoIF_L are LIFETIME and live in the existing
 *    `/api/users/:userid/metrics` endpoint. The whitepaper explicitly notes
 *    that game-level RoP and RoIF are uninteresting (sample size of 1ish),
 *    so we don't expose them per-game.
 *  - Both functions return null when the player isn't on the right side
 *    or never voted / was never targeted.
 *  - These are the CANONICAL implementations: the lifetime endpoint
 *    (/api/users/:userid/metrics) averages these per-game values, so any
 *    formula change here propagates everywhere consistently.
 *  - Whitepaper deviation (intentional): the whitepaper's RoS divides by
 *    5·|V|, which can exceed [-1, 1] when several spies are suspected per
 *    record. We divide by 5·spyCount·|V| so RoS is always bounded in
 *    [-1, 1]. Empty slots (gamma = 0) are skipped and gamma is clamped to
 *    {0..5} defensively (ingest also validates this).
 */

export function computeRoS_G(userid: string, rows: MetricsRow[]): number | null {
    if (rows.length === 0) return null;
    const players = rows[0]!.players;
    const role = players[userid] ?? null;
    if (role === null || SPY_ROLES.has(role)) return null;

    const spyCount = countSpies(players);
    if (spyCount === 0) return null;

    let sum = 0;
    let roundsWhereUserVoted = 0;

    for (const row of rows) {
        const myVotes = row.suspicions?.[userid];
        if (!myVotes) continue;
        roundsWhereUserVoted++;
        for (const [targetId, rawGamma] of Object.entries(myVotes)) {
            const gamma = clampGamma(rawGamma);
            // gamma = 0 is a deliberately blank slot: per the whitepaper it
            // still counts as a record, contributing 0 to the sum — so a
            // submitted all-blank ballot scores 0, not null.
            if (gamma === 0) continue;
            const targetRole = players[targetId] ?? null;
            if (targetRole === null) continue;
            const c = SPY_ROLES.has(targetRole) ? 1 : -1;
            sum += c * gamma;
        }
    }

    if (roundsWhereUserVoted === 0) return null;
    return sum / (5 * spyCount * roundsWhereUserVoted);
}

export function computeRoI_G(userid: string, rows: MetricsRow[]): number | null {
    if (rows.length === 0) return null;
    const players = rows[0]!.players;
    const role = players[userid] ?? null;
    if (role === null || !SPY_ROLES.has(role)) return null;

    const spyCount = countSpies(players);
    if (spyCount === 0) return null;

    let totalR = 0;
    let userWeightedSum = 0;

    for (const row of rows) {
        if (!row.suspicions) continue;
        for (const [, votes] of Object.entries(row.suspicions)) {
            for (const [targetId, rawGamma] of Object.entries(votes)) {
                const gamma = clampGamma(rawGamma);
                if (gamma === 0) continue;
                totalR++;
                if (targetId === userid) userWeightedSum += gamma;
            }
        }
    }

    if (totalR === 0) return null;
    return 1 - (spyCount / (5 * totalR)) * userWeightedSum;
}

function countSpies(players: Record<string, string | null>): number {
    let n = 0;
    for (const role of Object.values(players)) {
        if (role !== null && SPY_ROLES.has(role)) n++;
    }
    return n;
}

function clampGamma(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 5) return 5;
    return Math.round(n);
}
