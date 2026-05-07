export type PlayerId = number;

/**
 * All possible roles. Future plugins can extend this union
 * * Spies: spy, assassin, false-commander, deep-cover, blind-spy
 * * Resistance: resistance, commander, bodyguard
 */
export type RoleName = 'resistance' | 'spy'
    | 'commander' | 'bodyguard'
    | 'assassin' | 'false-commander'
    | 'deep-cover' | 'blind-spy';

/**
 * Roles as seen by other players
 */
export type KnownRole = RoleName | 'commander-candidate';

export function teamOf(role: RoleName): 'resistance' | 'spy' {
    switch (role) {
        case 'resistance':
        case 'commander':
        case 'bodyguard':
            return 'resistance';
        default:
            return 'spy';
    }
}


export interface GameConfig {
    playerCount: number;
    modulesEnabled: string[];
    optionalRoles: RoleName[];
}

/**
 * Ruleset derived from playerCount.
 * Includes mission sizes, spy counts, and Plot Thickens deck configuration.
 */
export interface GameRules {
    spyCount: number;
    missionSizes: [number, number, number, number, number];
    plotCardsPerRound: number;
    plotDeckSize: number;
}

/**
 * Generates the rules for a specific player count
 * @throws Error if playerCount is not between 5 and 10.
 */
export function getRulesFor(playerCount: number): GameRules {
    if (playerCount < 5 || playerCount > 10) {
        throw new Error(`Invalid player count: ${playerCount} in getRulesFor()`);
    }
    const spyCounts: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
    const missionSizes: Record<number, [number, number, number, number, number]> = {
        5:  [2, 3, 2, 3, 3],
        6:  [2, 3, 4, 3, 4],
        7:  [2, 3, 3, 4, 4],
        8:  [3, 4, 4, 5, 5],
        9:  [3, 4, 4, 5, 5],
        10: [3, 4, 4, 5, 5],
    };
    return {
        spyCount: spyCounts[playerCount]!,
        missionSizes: missionSizes[playerCount]!,
        plotCardsPerRound: playerCount <= 6 ? 1 : playerCount <= 8 ? 2 : 3,
        plotDeckSize: playerCount <= 6 ? 7 : 15, // this is in the actual rules but we can change it if we want to
    };
}

export type GamePhase = 'lobby' | 'role-reveal'
    | 'nomination' | 'voting' | 'suspicion'
    | 'mission' | 'assassination'
    | 'game-over';

/**
 * Individual player data
 * @note `role` and `knownRoles` are optional here because they are
 * redacted by the server depending on who is receiving the data
 */
export interface PlayerState {
    playerId: PlayerId;
    connected: boolean;
    plotCardsInHand: PlotCardState[];
    role: RoleName | undefined;
    knownRoles: Record<PlayerId, KnownRole> | undefined;
}

export type PlotCardName = 'overheard-conversation' | 'establish-confidence' | 'open-up'
    | 'opinion-maker' | 'no-confidence' | 'keeping-a-close-eye'
    | 'strong-leader' | 'in-the-spotlight' | 'take-responsibility';

export type PlotCardType = 'immediate' | 'held' | 'permanent';

export interface PlotCardState {
    instanceId: string;
    cardName: PlotCardName;
    cardType: PlotCardType;
    heldBy: PlayerId;
}

// Needed to check if a card was played already in the current round. Also useful for metrics
export interface PlotCardRecord {
    instanceId: string;
    cardName: PlotCardName;
    cardType: PlotCardType;
    distributedTo: PlayerId;
    playedBy: PlayerId | null;
    targetId: PlayerId | null;
    mission: number;
}

export interface MissionCardRecord {
    card: boolean;
    playerId: PlayerId | undefined;
}

export interface NominationAttempt {
    round: number; // 0-based index within a round
    leader: PlayerId;
    proposedTeam: PlayerId[];
    votes: Record<PlayerId, boolean>;
    outcome: boolean;
    numberOfSpies: number;
    /**
     * @note We should add suspicions here. Not on first round so | undefined
     */
    suspicions: Record<PlayerId, Record<PlayerId, number>> | undefined;
}

/**
 * Record for one completed round, including all nomination attempts, votes, mission cards, and plot cards played.
 */
export interface MissionResult {
    mission: number;
    nominations: NominationAttempt[];
    cards: MissionCardRecord[];
    failCount: number;
    success: boolean;
}

/**
 * Describes the current state and is used in serializeFor
 * @see ResistanceState.serializeFor
 */
export interface GameState {
    phase: GamePhase;
    mission: number;
    round: number;
    leaderId: PlayerId;
    nominatedTeam: PlayerId[];
    missions: MissionResult[];
    players: Record<PlayerId, PlayerState>;
    spyWins: number;
    resistanceWins: number;
    winner: 'resistance' | 'spies' | null;
    assassinationTarget: PlayerId | null;
}