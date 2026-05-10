import { ClientEventsBase } from "./types/Events.js";
import { RoleName } from "./types/GameTypes.js";

const ALL_ROLES: ReadonlySet<RoleName> = new Set<RoleName>([
    'resistance', 'spy',
    'commander', 'bodyguard',
    'assassin', 'false-commander',
    'deep-cover', 'blind-spy',
]);

const KNOWN_EVENTS: ReadonlySet<keyof ClientEventsBase> = new Set([
    'game:configure',
    'game:start',
    'role:submit',
    'nomination:submit',
    'vote:cast',
    'sus:submit',
    'mission:play-card',
    'lobby:reorder',
]);

export type ValidationResult =
    | { ok: true }
    | { ok: false; reason: string };

const ok: ValidationResult = { ok: true };
const fail = (reason: string): ValidationResult => ({ ok: false, reason });

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Player IDs may arrive as integers OR as digit-strings — Postgres returns
 * BIGINT columns as strings to avoid 53-bit precision loss, so the values
 * flowing through state and back out via JSON are strings end-to-end.
 * Either form is valid; downstream comparisons (Map.has, indexOf) are
 * type-consistent within a single message.
 */
function isPlayerId(v: unknown): boolean {
    if (typeof v === 'number') return Number.isInteger(v);
    if (typeof v === 'string') return /^-?\d+$/.test(v);
    return false;
}

function isPlayerIdArray(v: unknown): v is Array<number | string> {
    return Array.isArray(v) && v.every(isPlayerId);
}

/**
 * Validates that an inbound WS message has a known event name and a
 * payload of the expected shape. The senderId is appended later by the
 * upgrade route, so we don't check for it here.
 */
export function validateClientEvent(event: unknown, data: unknown): ValidationResult {
    if (typeof event !== 'string') return fail('event must be a string');
    if (!KNOWN_EVENTS.has(event as keyof ClientEventsBase)) {
        return fail(`unknown event '${event}'`);
    }
    if (!isObject(data)) return fail(`data for '${event}' must be an object`);

    switch (event as keyof ClientEventsBase) {
        case 'game:configure': {
            if (!Array.isArray(data.modulesEnabled) || !data.modulesEnabled.every(m => typeof m === 'string')) {
                return fail('modulesEnabled must be string[]');
            }
            if (!Array.isArray(data.optionalRoles) || !data.optionalRoles.every(r => typeof r === 'string' && ALL_ROLES.has(r as RoleName))) {
                return fail('optionalRoles must be RoleName[]');
            }
            return ok;
        }

        case 'game:start': {
            if (!isPlayerId(data.leaderId)) {
                return fail('leaderId must be a player id (integer or numeric string)');
            }
            if (!isPlayerIdArray(data.seatOrder)) return fail('seatOrder must be PlayerId[]');
            return ok;
        }

        case 'role:submit': {
            if (typeof data.role !== 'string' || !ALL_ROLES.has(data.role as RoleName)) {
                return fail('role must be a known RoleName');
            }
            return ok;
        }

        case 'nomination:submit': {
            if (!isPlayerIdArray(data.team)) return fail('team must be PlayerId[]');
            if (new Set(data.team).size !== data.team.length) return fail('team has duplicate playerIds');
            return ok;
        }

        case 'vote:cast': {
            if (typeof data.vote !== 'boolean') return fail('vote must be boolean');
            return ok;
        }

        case 'sus:submit': {
            if (!isObject(data.sus)) return fail('sus must be an object');
            for (const [k, v] of Object.entries(data.sus)) {
                if (!Number.isInteger(Number(k))) return fail('sus keys must be integer playerIds');
                if (typeof v !== 'number' || !Number.isFinite(v)) return fail('sus values must be finite numbers');
            }
            return ok;
        }

        case 'mission:play-card': {
            if (typeof data.card !== 'boolean') return fail('card must be boolean');
            return ok;
        }

        case 'lobby:reorder': {
            if (!isPlayerIdArray(data.seatOrder)) return fail('seatOrder must be PlayerId[]');
            if (new Set(data.seatOrder).size !== data.seatOrder.length) return fail('seatOrder has duplicate playerIds');
            return ok;
        }
    }

    return fail('unhandled event');
}
