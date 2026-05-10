import type { ResistanceState } from '../ResistanceState.js';
import type { MissionResult, NominationAttempt } from '../types/GameTypes.js';
import type { MetricsRow } from '../../routes/api/users/_userid/metrics/index.js';

/**
 * Reconstruct the same row shape the metrics SQL produces, but from a live
 * `ResistanceState` snapshot at game-end. Letting us reuse `computeGamePoints`
 * for both fresh game-end scoring and recompute-from-DB.
 *
 * IMPORTANT: call this synchronously, BEFORE any `structuredClone(state)`,
 * because clone strips the `players` Map's prototype.
 *
 * Half-built nominations (no finalized `outcome`) are skipped so points
 * never see partial data.
 */
export function metricsRowsFromState(state: ResistanceState, gameid: number): MetricsRow[] {
    const players = playersJsonbFromState(state);
    const resistance_win =
        state.endWinner === 'resistance' ? true
        : state.endWinner === 'spies' ? false
        : null;

    const rows: MetricsRow[] = [];
    let synthRoundId = 1;

    // Completed missions — each carries an ordered list of nomination attempts.
    for (const mission of state.missions) {
        const lastIdx = mission.nominations.length - 1;
        for (let i = 0; i < mission.nominations.length; i++) {
            const attempt = mission.nominations[i]!;
            if (!isFinalizedNomination(attempt)) continue;

            // Only the approved (last) attempt of a completed mission carries
            // the mission result + per-player cards.
            const isApprovedAttempt = i === lastIdx && attempt.outcome === true;
            const mission_status = isApprovedAttempt ? mission.success : null;
            const mission_cards = isApprovedAttempt ? cardsToRecord(mission) : null;

            rows.push({
                game_id: gameid,
                round_id: synthRoundId++,
                leader_userid: String(attempt.leader),
                mission_participent_userids: attempt.proposedTeam.map(String),
                count_spies_nominated: attempt.numberOfSpies,
                vote_status: attempt.outcome,
                mission_status,
                suspicions: suspicionsToStringKeys(attempt.suspicions ?? null),
                players,
                resistance_win,
                round_index_in_game: rows.length,
                vote_poll: votesToStringKeys(attempt.votes),
                mission_cards,
            });
        }
    }

    // Trailing rejected-spree (game ended via 5x nomination rejection): these
    // live in pendingNominations and never went on a mission.
    for (const attempt of state.pendingNominations) {
        if (!isFinalizedNomination(attempt)) continue;
        rows.push({
            game_id: gameid,
            round_id: synthRoundId++,
            leader_userid: String(attempt.leader),
            mission_participent_userids: attempt.proposedTeam.map(String),
            count_spies_nominated: attempt.numberOfSpies,
            vote_status: attempt.outcome,
            mission_status: null,
            suspicions: suspicionsToStringKeys(attempt.suspicions ?? null),
            players,
            resistance_win,
            round_index_in_game: rows.length,
            vote_poll: votesToStringKeys(attempt.votes),
            mission_cards: null,
        });
    }

    return rows;
}

function isFinalizedNomination(a: NominationAttempt): boolean {
    return typeof a.outcome === 'boolean'
        && Array.isArray(a.proposedTeam)
        && a.votes !== null && a.votes !== undefined;
}

function playersJsonbFromState(state: ResistanceState): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const [id, player] of state.players.entries()) {
        out[String(id)] = player.role ?? null;
    }
    return out;
}

function cardsToRecord(mission: MissionResult): Record<string, 'success' | 'fail'> | null {
    const out: Record<string, 'success' | 'fail'> = {};
    for (const c of mission.cards) {
        if (c.playerId === undefined) continue;
        out[String(c.playerId)] = c.card ? 'success' : 'fail';
    }
    return Object.keys(out).length === 0 ? null : out;
}

function votesToStringKeys(votes: Record<number, boolean>): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const [voter, vote] of Object.entries(votes)) {
        out[String(voter)] = Boolean(vote);
    }
    return out;
}

function suspicionsToStringKeys(
    s: Record<number, Record<number, number>> | null,
): Record<string, Record<string, number>> | null {
    if (!s) return null;
    const out: Record<string, Record<string, number>> = {};
    for (const [voter, votes] of Object.entries(s)) {
        const inner: Record<string, number> = {};
        for (const [target, gamma] of Object.entries(votes as Record<string, number>)) {
            inner[String(target)] = Number(gamma);
        }
        out[String(voter)] = inner;
    }
    return out;
}
