import {GameConfig, GameRules, GamePhase, GameState, MissionResult, PlayerState, PlayerId, PlotCardState, teamOf, RoleName, NominationAttempt} from './types/GameTypes.js';

/**
 * Server-side full state. Use serializeFor(playerId) to produce the client-safe view
 */
export class ResistanceState {

    config: GameConfig = {
        playerCount: 0,
        modulesEnabled: [],
        optionalRoles: [],
    };

    phase: GamePhase = 'lobby';
    mission: number = 0;
    round: number = 0;
    count_rounds: number = 0;
    leaderId: PlayerId = 1;
    nominatedTeam: PlayerId[] = [];

    pendingVotes: Record<PlayerId, boolean> = {};
    pendingSuspicions: Record<PlayerId, Record<PlayerId, number>> = {};

    pendingNominations: NominationAttempt[] = [];

    pendingMissionCards: Record<PlayerId, boolean> = {};


    missions: MissionResult[] = [];

    // Set when game:configure is emitted and never changes after game start
    rules: GameRules | null = null;

    /**
     * All player states are stored here, keyed by playerId
     * @note `role` and `knownRoles` are populated on game start
     * @warning Do not send this directly to players, use serializeFor() to apply visibility rules
     */
    players: Map<PlayerId, PlayerState> = new Map<PlayerId, PlayerState>();

    seatOrder: PlayerId[] = [];

    assassinationTarget: PlayerId | null = null;

    endWinner: 'spies' | 'resistance' | null = null;

    get spyWins(): number {
        return this.missions.filter(m => !m.success).length;
    }

    get resistanceWins(): number {
        return this.missions.filter(m => m.success).length;
    }

    get winner(): 'spies' | 'resistance' | null {
        if (this.endWinner !== null) return this.endWinner;

        if (this.spyWins >= 3) return 'spies';
        if (this.resistanceWins >= 3) return 'resistance';

        return null;
    }

    get activeRules(): GameRules {
        if (!this.rules) {
            throw new Error("Attempted to access game rules before they were initialized.");
        }
        return this.rules;
    }

    /**
     * @note Might not be needed, look into later
     * @param id
     */
    getActivePlayer(id: PlayerId): PlayerState & { role: RoleName } {
        const player = this.players.get(id);

        if (!player) throw new Error(`Player ${id} does not exist in this game.`);

        if (!player.role) throw new Error(`Player ${id} has no role assigned yet.`);

        return player as PlayerState & { role: RoleName }; // tells TS role is definitely there
    }

    isLeader(playerId: PlayerId): boolean {
        return this.leaderId === playerId;
    }

    getNextLeader(): PlayerId {
        const order = this.seatOrder;
        if (order.length === 0) return this.leaderId;

        const start = order.indexOf(this.leaderId);
        // Walk seat order, skipping any player who is currently
        // disconnected. If we make a full loop without finding one,
        // fall back to the current leader.
        for (let step = 1; step <= order.length; step++) {
            const candidate = order[(start + step) % order.length]!;
            const player = this.players.get(candidate);
            if (player?.connected) return candidate;
        }
        return this.leaderId;
    }

    getTeamOf(playerId: PlayerId): 'resistance' | 'spy' {
        return teamOf(this.getActivePlayer(playerId).role);
    }

    getCardsHeldBy(playerId: PlayerId): PlotCardState[] {
        return this.getActivePlayer(playerId).plotCardsInHand;
    }

    findCardHolder(instanceId: string): { player: PlayerState; card: PlotCardState } | null {
        for (const player of this.players.values()) {
            const card = player.plotCardsInHand.find(c => c.instanceId === instanceId);
            if (card) return { player, card };
        }
        return null;
    }

    getSpies(): PlayerId[] {
        const spies: PlayerId[] = [];
        for (const [id, player] of this.players) {
            if (teamOf(player.role!) === 'spy') {
                spies.push(id);
            }
        }
        return spies;
    }

    allVotesCast(): boolean {
        return Object.keys(this.pendingVotes).length === this.players.size;
    }

    allSusCast(): boolean {
        // Spy submissions are dropped server-side, so the round advances
        // once every resistance player has submitted.
        let resistanceCount = 0;
        for (const player of this.players.values()) {
            if (player.role !== undefined && teamOf(player.role) === 'resistance') {
                resistanceCount++;
            }
        }
        return Object.keys(this.pendingSuspicions).length >= resistanceCount;
    }

    allMissionCardsCast(): boolean {
        return this.nominatedTeam.every(id => id in this.pendingMissionCards);
    }

    /**
     * Produces a redacted JSON string of the game state for a specific player, applying visibility rules:
     * - role: shown to the owning player
     * - knownRoles: shown to the owning player
     * - MissionCardRecord.playerId: omitted until 'game-over'
     * - assassinationTarget: omitted until 'assassination' or 'game-over'
     * @param playerId The player to serialize the state for
     * @returns A JSON string of the game state with information redacted according to the rules above
     */
    serializeFor(playerId: PlayerId): string {
        const self = this.players.get(playerId);
        if (!self) throw new Error(`Player ${playerId} not found in serializeFor`);

        const showMissionAuthors = this.phase === 'game-over';
        const showAssassination = this.phase === 'assassination' || this.phase === 'game-over';

        const players: Record<PlayerId, PlayerState> = {};
        for (const [id, player] of this.players.entries()) {
            const isSelf = id === playerId;

            players[id] = {
                playerId: player.playerId,
                connected: player.connected,
                plotCardsInHand: player.plotCardsInHand,
                role: isSelf ? player.role : undefined,
                knownRoles: isSelf ? player.knownRoles : undefined,
            };
        }

        const state: GameState = {
            phase: this.phase,
            mission: this.mission,
            round: this.round,
            leaderId: this.leaderId,
            nominatedTeam: this.nominatedTeam,
            missions: this.missions.map(mission => ({
                ...mission,
                cards: mission.cards.map(card => ({
                    card: card.card,
                    playerId: showMissionAuthors ? card.playerId : undefined,
                })),
            })),
            players,
            spyWins: this.spyWins,
            resistanceWins: this.resistanceWins,
            winner: this.winner,
            assassinationTarget: showAssassination ? this.assassinationTarget : null,
            votedPlayerIds: Object.keys(this.pendingVotes).map(Number),
            submittedSuspicionPlayerIds: Object.keys(this.pendingSuspicions).map(Number),
            playedMissionCardPlayerIds: Object.keys(this.pendingMissionCards).map(Number),
        };

        return JSON.stringify(state);
    }

    /**
     * Serializes the redacted state for many recipients at once, building
     * the shared (recipient-independent) parts a single time. Equivalent to
     * calling serializeFor(id) per recipient, but a 10-player broadcast no
     * longer redacts the missions/players structures 10 times over.
     */
    serializeForAll(recipientIds: PlayerId[]): Map<PlayerId, string> {
        const showMissionAuthors = this.phase === 'game-over';
        const showAssassination = this.phase === 'assassination' || this.phase === 'game-over';

        const publicPlayers: Record<PlayerId, PlayerState> = {};
        for (const [id, player] of this.players.entries()) {
            publicPlayers[id] = {
                playerId: player.playerId,
                connected: player.connected,
                plotCardsInHand: player.plotCardsInHand,
                role: undefined,
                knownRoles: undefined,
            };
        }

        const shared: Omit<GameState, 'players'> = {
            phase: this.phase,
            mission: this.mission,
            round: this.round,
            leaderId: this.leaderId,
            nominatedTeam: this.nominatedTeam,
            missions: this.missions.map(mission => ({
                ...mission,
                cards: mission.cards.map(card => ({
                    card: card.card,
                    playerId: showMissionAuthors ? card.playerId : undefined,
                })),
            })),
            spyWins: this.spyWins,
            resistanceWins: this.resistanceWins,
            winner: this.winner,
            assassinationTarget: showAssassination ? this.assassinationTarget : null,
            votedPlayerIds: Object.keys(this.pendingVotes).map(Number),
            submittedSuspicionPlayerIds: Object.keys(this.pendingSuspicions).map(Number),
            playedMissionCardPlayerIds: Object.keys(this.pendingMissionCards).map(Number),
        };

        const out = new Map<PlayerId, string>();
        for (const id of recipientIds) {
            const self = this.players.get(id);
            if (!self) continue;
            const players: Record<PlayerId, PlayerState> = {
                ...publicPlayers,
                [id]: { ...publicPlayers[id]!, role: self.role, knownRoles: self.knownRoles },
            };
            out.set(id, JSON.stringify({ ...shared, players }));
        }
        return out;
    }

    toJSON() {
        return {
            ...this,
            players: Object.fromEntries(this.players),
        };
    }

    /**
     * Fully unredacted state for server-side storage after game end
     */
    serializeForMetrics(): string {
        return JSON.stringify(this);
    }

    /**
     * Reconstructs from a state string (should be the full unredacted state)
     */
    static fromJSON(json: string): ResistanceState {
        const state = new ResistanceState();
        const parsed = JSON.parse(json);
        Object.assign(state, {
            ...parsed,
            players: new Map(Object.entries(parsed.players).map(([k, v]) => [Number(k), v]))
        });
        return state;
    }
}