/**
 * Action-point catalog for the R/S/P-Index system (see CS 222 Whitepaper).
 *
 * Every observable action a player can take, plus the passive consequences
 * other players' actions have on them, has a point value here. Categories:
 *
 *   - Voting on nominations          (4 cells: {clean,dirty} × {approve,reject})
 *   - Mission outcome bonus           (added on top of the vote when approved)
 *   - Mission team participation     (on-team × mission succeeded/failed)
 *   - Mission card played             (per-player Success/Fail; post-migration)
 *   - Leadership                      (proposing clean/dirty teams; bonus when approved)
 *   - Suspicion (active)              (resistance only — spies are dropped server-side)
 *   - Suspicion (passive)             (this is the big new one: each suspicion
 *                                     submitter who OMITS you adds points; each
 *                                     who MARKS you subtracts γ × multiplier).
 *   - Game outcome                    (won, lost — both sides)
 *
 * Spy values are larger than their resistance equivalents to keep the
 * P-Index stable across the ~62/38 role-frequency split.
 *
 * Bump CATALOG_VERSION on any value change and rerun the recompute script
 * to repopulate `player_game_metrics`.
 */

export const CATALOG_VERSION = '2' as const;

export const RESISTANCE_ACTION_POINTS = {
    // === Voting on a nomination (one of these always fires per row with a vote) ===
    approve_clean_team:                +1,
    approve_dirty_team:                -3,
    reject_clean_team:                 -1,
    reject_dirty_team:                 +2,

    // === Mission outcome bonus (additive when the vote was approved AND mission ran) ===
    approved_clean_succeeded:          +1,   // your clean approve paid off
    approved_dirty_failed:             -2,   // your approval helped a sabotage
    approved_clean_failed:             -1,   // bad luck — clean team still failed
    approved_dirty_succeeded:          +1,   // dirty team approved but spy didn't sabotage

    // === Mission team participation (when on the team) ===
    on_team_mission_succeeded:         +1,
    on_team_mission_failed:             0,   // you played success — neutral
    /** Personally pulled the trigger as resistance — major loyalty break. */
    played_fail_card:                  -5,

    // === Leadership (when you were the leader of the nomination) ===
    led_clean_team:                    +2,
    led_dirty_team:                    -2,
    led_dirty_team_approved:           -1,   // extra bite — your dirty team passed

    // === Suspicion (active, by you) — scales by confidence γ ∈ 1..5 ===
    suspicion_correct_per_gamma:       +1,
    suspicion_incorrect_per_gamma:     -1,

    // === Suspicion (passive, against you) ===
    /** +N for every resistance voter who submitted suspicions and OMITTED you. */
    trusted_by_resistance_per_voter:   +1,
    /** ×γ for every resistance voter who included you at confidence γ. */
    suspected_by_resistance_per_gamma: -1,

    // === Game outcome ===
    game_won:                          +5,
    game_lost:                         -3,
} as const;

export const SPY_ACTION_POINTS = {
    // === Voting on a nomination ===
    approve_clean_team:                -1,   // missed an opportunity to influence
    approve_dirty_team:                +2,   // moving the spy agenda forward
    reject_clean_team:                 +2,   // sowing mistrust
    /** Voting against your own team — explicit penalty for self-sabotage. */
    reject_dirty_team:                 -3,

    // === Mission outcome bonus (additive when vote was approved AND mission ran) ===
    approved_dirty_failed:             +3,   // your approval set up the sabotage
    approved_dirty_succeeded:          -2,   // approved a dirty team that didn't sabotage
    approved_clean_succeeded:          -1,   // mild cost — you helped resistance succeed
    approved_clean_failed:             +1,   // lucky outcome went your way

    // === Mission team participation (when on the team) ===
    on_team_mission_failed:            +5,   // sabotage went through (collective)
    on_team_mission_succeeded:         -3,   // missed the chance / forced to play success
    /** Personally pulled the trigger. Requires post-migration mission_cards data. */
    played_fail_card:                  +3,
    /** Played success on a team that ended up failing — let teammate take the heat. */
    played_success_when_failed:        -1,

    // === Leadership ===
    led_dirty_team:                    +2,
    led_clean_team:                    -3,
    led_dirty_team_approved:           +2,

    // === Suspicion (passive, against you) — the user's example dynamic ===
    /** +N for every resistance voter who submitted but DID NOT mark you. */
    trusted_by_resistance_per_voter:   +3,
    /** ×γ for every resistance voter who marked you at confidence γ. */
    suspected_by_resistance_per_gamma: -2,

    // === Game outcome ===
    game_won:                          +8,
    game_lost:                         -5,
} as const;

export type ResistanceActionKey = keyof typeof RESISTANCE_ACTION_POINTS;
export type SpyActionKey        = keyof typeof SPY_ACTION_POINTS;
export type ActionKey           = ResistanceActionKey | SpyActionKey;
