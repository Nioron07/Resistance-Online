import {KnownRole, PlayerId, RoleName} from './GameTypes.js';

// Client -> Server
export type ClientEventsBase = {

    'game:configure': {
        modulesEnabled: string[];
        optionalRoles: RoleName[];
    }

    'game:start': {
        leaderId: PlayerId;
        seatOrder: PlayerId[];
    }

    'role:submit': {
        role: RoleName;
    }

    'nomination:submit': {
        team: PlayerId[];
    }

    'vote:cast': {
        vote: boolean;
    }

    'sus:submit': {
        sus: Record<PlayerId, number>;
    }

    'mission:play-card': {
        card: boolean;
    }

    /**
     * Host-only, lobby-phase only. Replaces the seat order with the
     * given permutation of current players. Server validates that
     * `seatOrder` contains exactly the current set of players in
     * `state.players` with no duplicates.
     */
    'lobby:reorder': {
        seatOrder: PlayerId[];
    }

    // // immediate cards go into the "hand" and are resolved immediately by the frontend sending 'plot-card:play'
    // 'plot-card:drawn': {
    //     cardName: PlotCardName;
    //     recipientId: PlayerId;
    // }
    //
    // // targetId required when the card needs one.
    // 'plot-card:play': {
    //     instanceId: string;
    //     targetId?: PlayerId;
    // }

    // 'assassination:target': {
    //     targetId: PlayerId;
    // }
}

/**
 * Generally you dont allow users to send their own playerId and we validate it server-side
 *
 * For actual ClientEvents we automatically append a senderId field to every event
 *
 * The actual frontend should refer to ClientEventsBase to know what data to send
 */
export type ClientEvents = {
    [K in keyof ClientEventsBase]: ClientEventsBase[K] & {senderId: PlayerId};
}

// Server -> Server
export type InternalEvents = {

    'player:join': {
        playerId: PlayerId;
    }

    'player:leave': {
        playerId: PlayerId;
    }

    'player:reconnect': {
        playerId: PlayerId;
    }

    'player:disconnect': {
        playerId: PlayerId;
    }

    'roles:assigned': Record<string, never>,

    'nomination:start': Record<string, never>,

    'nomination:resolve': {
        approved: boolean;
    }

    'mission:start': Record<string, never>,

    'mission:complete': {
        result: boolean;
        failCount: number
    }

    'suspicion:complete': {
        cameFromMission: boolean;
    }

    'game:ended': {
        winner: 'resistance' | 'spies';
        reason: string;
    }
}

// Server -> Client
export type ServerEvents = {

    'player:joined': {
        playerId: PlayerId;
        players: PlayerId[];
    }

    'player:left': {
        playerId: PlayerId;
    }

    'player:reconnected': {
        playerId: PlayerId;
    }

    'player:disconnected': {
        playerId: PlayerId;
    }

    /**
     * Broadcast whenever the lobby seat order changes — joins, leaves,
     * or an explicit `lobby:reorder` from the host. Clients should
     * replace their local seat-order with `seatOrder`.
     */
    'lobby:reordered': {
        seatOrder: PlayerId[];
        hostId: PlayerId | null;
    }

    'game:started': Record<string, never>

    'role:assigned': {
        role: RoleName;
        knownRoles: Record<PlayerId, KnownRole> | undefined;
    }

    'nomination:started': {
        leaderId: PlayerId;
        mission: number;
        round: number
    }

    'nomination:submitted': {
        team: PlayerId[]
    }

    'vote:received': {
        playerId: PlayerId;
    }

    'mission:card-played': {
        playerId: PlayerId;
    }

    'suspicion:received': {
        playerId: PlayerId;
    }

    'suspicion:started': Record<string, never>

    'vote:result': {
        votes: Record<PlayerId, boolean>;
        approved: boolean;
    }

    'mission:started': {
        mission: number,
        leaderId: PlayerId,
        team: PlayerId[]
    }

    // // broadcasted to all since plot cards are face up
    // 'plot-card:received': {
    //     instanceId: string;
    //     cardName: PlotCardName;
    //     cardType: PlotCardType;
    //     heldBy: PlayerId;
    // }

    'mission:result': {
        result: boolean;
        failCount: number;
    }

    'game:ended': {
        winner: 'resistance' | 'spies';
        reason: string;
    }

    'state:update': {
        state: string;
    }

    'socket:error': {
        message: string;
    }
}