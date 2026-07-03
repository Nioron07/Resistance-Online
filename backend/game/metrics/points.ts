import type { MetricsRow } from '../../routes/api/users/_userid/metrics/index.js';
import { SPY_ROLES } from '../../routes/api/users/_userid/metrics/index.js';
import {
    CATALOG_VERSION,
    RESISTANCE_ACTION_POINTS,
    SPY_ACTION_POINTS,
    type ActionKey,
    type ResistanceActionKey,
    type SpyActionKey,
} from './actionPoints.js';

export type Side = 'resistance' | 'spy';

export interface GamePointsResult {
    side: Side;
    points: number;
    breakdown: Record<string, number>;
    catalogVersion: string;
}

/**
 * Compute one player's points for a single completed game from per-round
 * rows. Pure / deterministic; safe to call from a transaction or a script.
 *
 * Returns `null` if `userid` did not participate in this game (per
 * `players` jsonb), or if the game is not finished (`resistance_win` null).
 */
export function computeGamePoints(userid: string, rows: MetricsRow[]): GamePointsResult | null {
    if (rows.length === 0) return null;

    const head = rows[0]!;
    const role = head.players[userid] ?? null;
    if (role === null) return null;
    if (head.resistance_win === null) return null;

    const side: Side = SPY_ROLES.has(role) ? 'spy' : 'resistance';
    const breakdown: Record<string, number> = {};

    for (const row of rows) {
        scoreVoteAndOutcome(side, userid, row, breakdown);
        scoreLeadership(side, userid, row, breakdown);
        scoreTeamParticipation(side, userid, row, breakdown);
        scoreActiveSuspicion(side, userid, row, breakdown);
        scorePassiveSuspicion(side, userid, row, breakdown);
    }

    // Game outcome.
    const userWon = side === 'resistance' ? head.resistance_win === true : head.resistance_win === false;
    if (userWon) addPoint(side, breakdown, 'game_won');
    else         addPoint(side, breakdown, 'game_lost');

    const points = sumBreakdown(breakdown);
    return { side, points, breakdown, catalogVersion: CATALOG_VERSION };
}

/**
 * Per-action breakdown one player earned in a single round (all per-round
 * scorers, no end-of-game outcome bonus). This is the building block for
 * the eval-bar time series: summing it over every round of a game plus the
 * outcome bonus reproduces computeGamePoints exactly.
 */
export function scoreRowBreakdownForPlayer(side: Side, userid: string, row: MetricsRow): Record<string, number> {
    const breakdown: Record<string, number> = {};
    scoreVoteAndOutcome(side, userid, row, breakdown);
    scoreLeadership(side, userid, row, breakdown);
    scoreTeamParticipation(side, userid, row, breakdown);
    scoreActiveSuspicion(side, userid, row, breakdown);
    scorePassiveSuspicion(side, userid, row, breakdown);
    return breakdown;
}

/** Total points one player earned in a single round. */
export function scoreRowForPlayer(side: Side, userid: string, row: MetricsRow): number {
    return sumBreakdown(scoreRowBreakdownForPlayer(side, userid, row));
}

// ---------------------------- voting + mission-outcome bonus ---------------------------- \\

function scoreVoteAndOutcome(
    side: Side,
    userid: string,
    row: MetricsRow,
    breakdown: Record<string, number>,
): void {
    const myVote = readVote(row, userid);
    if (myVote === undefined) return;

    const dirty = (row.count_spies_nominated ?? 0) > 0;

    // Base vote action — always one of these four for a row where you voted.
    if (myVote === true && !dirty)   addPoint(side, breakdown, 'approve_clean_team');
    else if (myVote === true)        addPoint(side, breakdown, 'approve_dirty_team');
    else if (myVote === false && !dirty) addPoint(side, breakdown, 'reject_clean_team');
    else                                  addPoint(side, breakdown, 'reject_dirty_team');

    // Mission-outcome bonus only fires if your YES vote helped the team get
    // approved AND the mission actually ran.
    if (myVote === true && row.vote_status === true && row.mission_status !== null) {
        if (!dirty && row.mission_status === true) {
            addPoint(side, breakdown, 'approved_clean_succeeded');
        } else if (dirty && row.mission_status === false) {
            addPoint(side, breakdown, 'approved_dirty_failed');
        } else if (!dirty && row.mission_status === false) {
            addPoint(side, breakdown, 'approved_clean_failed');
        } else {
            addPoint(side, breakdown, 'approved_dirty_succeeded');
        }
    }
}

// ---------------------------- leadership ---------------------------- \\

function scoreLeadership(
    side: Side,
    userid: string,
    row: MetricsRow,
    breakdown: Record<string, number>,
): void {
    if (String(row.leader_userid) !== userid) return;
    const dirty = (row.count_spies_nominated ?? 0) > 0;

    if (dirty) {
        addPoint(side, breakdown, 'led_dirty_team');
        if (row.vote_status === true) addPoint(side, breakdown, 'led_dirty_team_approved');
    } else {
        addPoint(side, breakdown, 'led_clean_team');
    }
}

// ---------------------------- team participation + card ---------------------------- \\

function scoreTeamParticipation(
    side: Side,
    userid: string,
    row: MetricsRow,
    breakdown: Record<string, number>,
): void {
    const team = (row.mission_participent_userids ?? []).map(String);
    if (!team.includes(userid)) return;
    if (row.vote_status !== true || row.mission_status === null) return;

    if (row.mission_status === true) {
        addPoint(side, breakdown, 'on_team_mission_succeeded');
    } else {
        addPoint(side, breakdown, 'on_team_mission_failed');
    }

    // Per-player card attribution requires the post-migration column.
    const myCard = row.mission_cards?.[userid];
    if (myCard === undefined) return;

    if (myCard === 'fail') {
        // Both sides have a `played_fail_card` entry; resistance is a major
        // loyalty break, spy is the explicit sabotage reward.
        addPoint(side, breakdown, 'played_fail_card');
    } else if (myCard === 'success' && row.mission_status === false && side === 'spy') {
        // Spy on a failed mission who personally played success — small penalty
        // for hiding behind the teammate that pulled the trigger.
        addSpy(breakdown, 'played_success_when_failed');
    }
}

// ---------------------------- active suspicion (resistance) ---------------------------- \\

function scoreActiveSuspicion(
    side: Side,
    userid: string,
    row: MetricsRow,
    breakdown: Record<string, number>,
): void {
    if (side !== 'resistance' || !row.suspicions) return;

    const myVotes = row.suspicions[userid];
    if (!myVotes) return;

    for (const [targetId, rawGamma] of Object.entries(myVotes)) {
        const gamma = clampGamma(rawGamma);
        if (gamma === 0) continue;
        const targetRole = row.players[targetId] ?? null;
        if (targetRole === null) continue;
        if (SPY_ROLES.has(targetRole)) addR(breakdown, 'suspicion_correct_per_gamma', gamma);
        else                            addR(breakdown, 'suspicion_incorrect_per_gamma', gamma);
    }
}

// ---------------------------- passive suspicion (both sides) ---------------------------- \\

/**
 * For each resistance voter who submitted a suspicion record this round,
 * either:
 *   - they OMITTED you  → trusted_by_resistance_per_voter (positive)
 *   - they MARKED you at γ → suspected_by_resistance_per_gamma × γ (negative)
 *
 * Magnitudes differ by side (spies see a much larger trust reward, since
 * "going undetected" is the spy's primary win condition).
 */
function scorePassiveSuspicion(
    side: Side,
    userid: string,
    row: MetricsRow,
    breakdown: Record<string, number>,
): void {
    if (!row.suspicions) return;

    for (const [voterId, votes] of Object.entries(row.suspicions)) {
        if (voterId === userid) continue; // don't reward yourself for not suspecting yourself
        const voterRole = row.players[voterId] ?? null;
        if (voterRole === null || SPY_ROLES.has(voterRole)) continue; // resistance voters only

        const gammaRaw = votes[userid];
        if (gammaRaw === undefined) {
            addPoint(side, breakdown, 'trusted_by_resistance_per_voter');
            continue;
        }
        const gamma = clampGamma(gammaRaw);
        if (gamma === 0) {
            // Slot was left empty; treat as a trust signal.
            addPoint(side, breakdown, 'trusted_by_resistance_per_voter');
        } else {
            addPoint(side, breakdown, 'suspected_by_resistance_per_gamma', gamma);
        }
    }
}

// ---------------------------- helpers ---------------------------- \\

function readVote(row: MetricsRow, userid: string): boolean | undefined {
    const poll = row.vote_poll;
    if (poll && Object.prototype.hasOwnProperty.call(poll, userid)) return poll[userid];
    return undefined;
}

/** Polymorphic add helper — looks up the keyed value in the side's catalog. */
function addPoint(
    side: Side,
    breakdown: Record<string, number>,
    key: ResistanceActionKey & SpyActionKey,
    multiplier?: number,
): void;
function addPoint<K extends ResistanceActionKey>(
    side: 'resistance',
    breakdown: Record<string, number>,
    key: K,
    multiplier?: number,
): void;
function addPoint<K extends SpyActionKey>(
    side: 'spy',
    breakdown: Record<string, number>,
    key: K,
    multiplier?: number,
): void;
function addPoint(
    side: Side,
    breakdown: Record<string, number>,
    key: string,
    multiplier = 1,
): void {
    const catalog = side === 'resistance'
        ? RESISTANCE_ACTION_POINTS as Record<string, number>
        : SPY_ACTION_POINTS as Record<string, number>;
    const v = catalog[key];
    if (v === undefined) return; // action key not defined for this side — skip silently
    addBreakdown(breakdown, key as ActionKey, v * multiplier);
}

function addR(b: Record<string, number>, key: ResistanceActionKey, multiplier = 1): void {
    addBreakdown(b, key, RESISTANCE_ACTION_POINTS[key] * multiplier);
}

function addSpy(b: Record<string, number>, key: SpyActionKey, multiplier = 1): void {
    addBreakdown(b, key, SPY_ACTION_POINTS[key] * multiplier);
}

function addBreakdown(b: Record<string, number>, key: ActionKey, delta: number): void {
    b[key] = (b[key] ?? 0) + delta;
}

function sumBreakdown(b: Record<string, number>): number {
    let total = 0;
    for (const v of Object.values(b)) total += v;
    return total;
}

function clampGamma(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 5) return 5;
    return Math.round(n);
}
