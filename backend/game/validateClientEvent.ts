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
]);

export type ValidationResult =
    | { ok: true }
    | { ok: false; reason: string };

const ok: ValidationResult = { ok: true };
const fail = (reason: string): ValidationResult => ({ ok: false, reason });

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPlayerIdArray(v: unknown): v is number[] {
    return Array.isArray(v) && v.every(x => typeof x === 'number' && Number.isInteger(x));
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
            if (typeof data.leaderId !== 'number' || !Number.isInteger(data.leaderId)) {
                return fail('leaderId must be an integer');
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
    }

    return fail('unhandled event');
}
