import {GamePlugin} from "./GamePlugin.js";
import {KnownRole, PlayerId, PlayerState, RoleName, teamOf} from "../types/GameTypes.js";
import { DAC } from "../../utils/db-queries/DataAccessClass.js";
import { roomManager } from "../../managers/RoomManager.js";

export class ResistanceCore extends GamePlugin {
    protected register() {
        const { bus, state, meta_data } = this.room

        let cameFromMission = false;

        // Send a 'socket:error' back to a single player. Best-effort: if their
        // socket is gone we just swallow it (broadcast already handles that).
        const notifySender = (playerId: PlayerId, message: string) => {
            const ws = this.room.players.get(playerId);
            if (ws) this.room.send(ws, "socket:error", { message });
        };

        /**
         * Resolve the nomination vote once every *connected* player has
         * voted. Disconnected players don't block the phase; their missing
         * votes count as rejects because approval still requires a majority
         * of ALL seated players.
         */
        const maybeResolveVotes = () => {
            if (state.phase !== 'voting') return;

            const allConnectedVoted = Array.from(state.players.values())
                .every(p => !p.connected || p.playerId in state.pendingVotes);
            if (!allConnectedVoted) return;
            if (Object.keys(state.pendingVotes).length === 0) return;

            const votes = state.pendingVotes;
            const approved = Object.values(votes).filter(v => v).length > state.players.size / 2;

            bus.emitInternal("nomination:resolve", {approved});
        };

        /**
         * Complete the suspicion phase once every *connected* resistance
         * player has submitted. Disconnected players don't block; their
         * records are simply absent for the round.
         */
        const maybeCompleteSuspicion = () => {
            if (state.phase !== 'suspicion') return;

            const allConnectedResistanceSubmitted = Array.from(state.players.values())
                .every(p => !p.connected
                    || p.role === undefined
                    || teamOf(p.role) === 'spy'
                    || p.playerId in state.pendingSuspicions);
            if (!allConnectedResistanceSubmitted) return;

            bus.emitInternal("suspicion:complete", {cameFromMission});
        };

        /**
         * Runs after LobbyPlugin (priority 100) has marked the player
         * disconnected. If the leaver was the one gating the current phase,
         * move the game along instead of stalling forever:
         * - nomination: rotate the leadership to the next connected player
         * - voting / suspicion: re-check completion without them
         * Mission and role-reveal can't be skipped (their input is the
         * content of the phase); those wait for a reconnect and fall back
         * to the abandoned-room teardown.
         */
        bus.on("player:disconnect", 50, e => {
            if (state.phase === 'nomination' && state.leaderId === e.playerId) {
                bus.emitInternal("nomination:start", {});
                return;
            }
            if (state.phase === 'voting') maybeResolveVotes();
            if (state.phase === 'suspicion') maybeCompleteSuspicion();
        });

        /**
         * role:submit -> roles:assigned once everyone has submitted.
         *
         * The payload reports the physical role card the player was dealt
         * (this is a companion app for in-person play). Once all roles are
         * in, the composition is validated against the rules — a wrong spy
         * count clears every role and asks the table to re-submit.
         */
        bus.on("role:submit", 100, e => {
            if (state.phase !== 'role-reveal') return;
            const player = state.players.get(e.senderId);
            if (!player) return;

            player.role = e.role;

            const allSubmitted = Array.from(state.players.values()).every(p => p.role !== undefined);
            if (!allSubmitted) return;

            // Self-reported roles must add up to a legal game: exactly
            // rules.spyCount spies. Anything else means someone misclicked
            // (or is lying about their card) — reset and re-collect.
            const spyCount = Array.from(state.players.values()).filter(p => teamOf(p.role!) === 'spy').length;
            if (spyCount !== state.activeRules.spyCount) {
                for (const p of state.players.values()) p.role = undefined;
                this.room.broadcast("role:reset", {
                    message: `Submitted roles don't match the rules (${spyCount} spies reported, expected ${state.activeRules.spyCount}). Everyone must re-select.`,
                });
                return;
            }

            for (const [playerId, p] of state.players.entries()) {
                DAC.resistance.games.id(meta_data.gameid).playerId(playerId).update(p.role!)
                    .catch(err => console.error('[DAC] playerId.update failed', err));
            }

            bus.emitInternal("roles:assigned", {});
        });

        /**
         * Independently sends each player 'role:assigned' which has their role and knownRoles based on other players roles
         * roles:assigned -> nomination:start
         */
        bus.on("roles:assigned", 100, _e => {
            for (const player of state.players.values()) {
                player.knownRoles = this.buildKnownRoles(player.playerId, player.role!, state.players);
            }

            for (const [playerId, ws] of this.room.players.entries()) {
                const player = state.getActivePlayer(playerId);
                this.room.send(ws, "role:assigned", {
                    role: player.role,
                    knownRoles: player.knownRoles,
                });
            }

            state.leaderId = state.seatOrder[(state.seatOrder.indexOf(state.leaderId) - 1 + state.seatOrder.length) % state.seatOrder.length]!;

            bus.emitInternal("nomination:start", {});
        });

        /**
         * Broadcasts nomination:started
         * Changes phase to 'nomination'
         */
        bus.on("nomination:start", 100, _e => {
            state.round = state.pendingNominations.length;
            state.count_rounds++;
            state.leaderId = state.getNextLeader();
            state.nominatedTeam = [];
            state.phase = 'nomination';

            this.room.broadcast("nomination:started", {
                leaderId: state.leaderId,
                mission: state.mission,
                round: state.round,
            });
        })

        /**
         * vote:cast -> nothing
         * IF all votes are cast then broadcasts nomination:submitted and changes phase to 'voting'
         */
        bus.on("nomination:submit", 100, e => {
            if (state.phase !== 'nomination') return;
            if (e.senderId !== state.leaderId) {
                notifySender(e.senderId, 'Only the current leader can submit a nomination.');
                return;
            }

            const teamSize = state.rules!.missionSizes[state.mission];
            if (e.team.length !== teamSize) {
                notifySender(e.senderId, `Team must have exactly ${teamSize} players for this mission.`);
                return;
            }

            // Make sure all nominated players are in the game
            if (e.team.some(id => !state.players.has(id))) {
                notifySender(e.senderId, 'One or more nominated players are not in this game.');
                return;
            }

            state.nominatedTeam = e.team;
            state.phase = 'voting';

            this.room.broadcast("nomination:submitted", {
                team: e.team,
            });
        });

        /**
         * vote:cast -> nothing OR nomination:resolve
         */
        bus.on("vote:cast", 100, e => {
            if (state.phase !== 'voting') return;
            if (!state.players.has(e.senderId)) return;
            if (e.senderId in state.pendingVotes) return;

            state.pendingVotes[e.senderId] = e.vote;

            // Notify everyone that a vote came in (without revealing the
            // value) so the UI can show partial progress.
            this.room.broadcast("vote:received", { playerId: e.senderId });

            maybeResolveVotes();
        });

        /**
         * Broadcasts vote:result and suspicion:started if the vote wasn't approved, it isn't the 5th round, and its not the first mission + round
         * nomination:resolve -> nomination:start OR mission:start OR game:ended OR nothing
         */
        bus.on("nomination:resolve", 100, e => {
            this.room.broadcast("vote:result", {
                votes: state.pendingVotes,
                approved: e.approved,
            });

            state.pendingNominations.push({
                round: state.round,
                leader: state.leaderId,
                proposedTeam: state.nominatedTeam,
                votes: state.pendingVotes,
                outcome: e.approved,
                numberOfSpies: state.nominatedTeam.filter(id => teamOf(state.players.get(id)!.role!) === 'spy').length,
                suspicions: undefined,
            });

            state.pendingVotes = {};

            if (e.approved) {
                state.phase = 'mission';
                bus.emitInternal("mission:start", {});
                return;
            } else if (state.round >= 4) {
                state.phase = 'game-over';

                // Insert the current round into the db --> Does not need to await as that row will never be touched again after this point
                console.log('[DAC] rounds.create called', {
                    mission: state.mission,
                    round: state.round,
                    pendingNominations: state.pendingNominations.length,
                    cameFromMission
                });
                DAC.resistance.rounds.create(meta_data.gameid, state)
                    .catch(err => console.error('[DAC] rounds.create failed', err));

                bus.emitInternal('game:ended', {winner: 'spies', reason: 'nomination-limit'});
                return;
            } else if (state.mission === 0 && state.round === 0) {
                // Insert the current round into the db --> Does not need to await as that row will never be touched again after this point
                console.log('[DAC] rounds.create called', {
                    mission: state.mission,
                    round: state.round,
                    pendingNominations: state.pendingNominations.length,
                    cameFromMission
                });
                DAC.resistance.rounds.create(meta_data.gameid, state)
                    .catch(err => console.error('[DAC] rounds.create failed', err));

                bus.emitInternal("nomination:start", {});
                return;
            }

            state.phase = 'suspicion';
            this.room.broadcast("suspicion:started", {});
        });

        /**
         * sus:submit -> suspicion:complete after all sus are cast
         */
        bus.on("sus:submit", 100, e => {
            if (state.phase !== 'suspicion') return;
            const sender = state.players.get(e.senderId);
            if (!sender) return;
            if (e.senderId in state.pendingSuspicions) return;

            // Spies' suspicions are noise/manipulation — drop them entirely
            // so they never reach the DB or any metric. Don't broadcast a
            // 'received' either; from the room's perspective the submission
            // never happened.
            if (sender.role !== undefined && teamOf(sender.role) === 'spy') {
                return;
            }

            state.pendingSuspicions[e.senderId] = e.sus;

            this.room.broadcast("suspicion:received", { playerId: e.senderId });

            maybeCompleteSuspicion();
        });

        /**
         * suspicion:complete -> nomination:start
         */
        bus.on("suspicion:complete", 100, e => {
            if (e.cameFromMission) {
                const lastMission = state.missions[state.missions.length - 1]!;
                const lastNomination = lastMission.nominations[lastMission.nominations.length - 1]!;
                lastNomination.suspicions = state.pendingSuspicions;
            } else {
                const lastNomination = state.pendingNominations[state.pendingNominations.length - 1]!;
                lastNomination.suspicions = state.pendingSuspicions;
            }

            // Insert the current round into the db --> Does not need to await as that row will never be touched again after this point
            console.log('[DAC] rounds.create called', {
                mission: state.mission,
                round: state.round,
                pendingNominations: state.pendingNominations.length,
                cameFromMission
            });
            DAC.resistance.rounds.create(meta_data.gameid, state)
                .catch(err => console.error('[DAC] rounds.create failed', err));


            if (e.cameFromMission) {
                /**
                 * @note Flushing the state is after the DAC call because I still need the data in the right format for the DB.
                 *      In addition, I wanted to keep everything in the state.
                 *      This works because `DAC.resistance.rounds.createRound()` calls `structuredClone()` on `@state`, so the async race condition here is avoided.
                 * - Joseph Habisohn 4/18/2026
                 */
                state.pendingNominations = [];
                state.pendingMissionCards = {};
            }
            
            /**
             * @note Flushing the state is after the DAC call because I still need the data in the right format for the DB.
             *      In addition, I wanted to keep everything in the state.
             *      This works because `DAC.resistance.rounds.createRound()` calls `structuredClone()` on `@state`, so the async race condition here is avoided.
             * - Joseph Habisohn 4/18/2026
             */
            state.pendingSuspicions = {};

            cameFromMission = false;

            bus.emitInternal("nomination:start", {});
        });

        /**
         * Broadcasts mission:started
         */
        bus.on('mission:start', 100, _e => {
            if (state.phase !== 'mission') return;

            this.room.broadcast('mission:started', {
                mission: state.mission,
                leaderId: state.leaderId,
                team: state.nominatedTeam
            });
        });

        /**
         * mission:play-card -> nothing OR mission:complete
         */
        bus.on('mission:play-card', 100, e => {
            if (state.phase !== 'mission') return;
            if (!state.nominatedTeam.includes(e.senderId)) {
                notifySender(e.senderId, 'You are not on the current mission team.');
                return;
            }
            if (e.senderId in state.pendingMissionCards) return;

            state.pendingMissionCards[e.senderId] = e.card;

            this.room.broadcast("mission:card-played", { playerId: e.senderId });

            if (!state.allMissionCardsCast()) return;

            const cards = state.pendingMissionCards;
            const failCount = Object.values(cards).filter(c => !c).length;
            const success = (state.config.playerCount >= 7 && state.mission === 3) ? failCount <= 1 : failCount === 0;

            state.missions.push({
                mission: state.mission,
                nominations: state.pendingNominations,
                cards: Object.entries(cards).map(([playerId, card]) => ({playerId: Number(playerId), card})),
                failCount,
                success
            });

            bus.emitInternal('mission:complete', {
                result: state.missions[state.missions.length - 1]!.success,
                failCount
            });
        });

        /**
         * Broadcasts mission:result and suspicion:started
         * mission:complete -> game:ended
         */
        bus.on('mission:complete', 100, e => {
            if (state.phase !== 'mission') return;

            const winner = state.winner

            this.room.broadcast('mission:result', {
                result: e.result,
                failCount: e.failCount
            })

            if (winner !== null) {
                state.phase = 'game-over';

                // Insert the current round into the db --> Does not need to await as that row will never be touched again after this point
                console.log('[DAC] rounds.create called', {
                    mission: state.mission,
                    round: state.round,
                    pendingNominations: state.pendingNominations.length,
                    cameFromMission
                });
                DAC.resistance.rounds.create(meta_data.gameid, state)
                    .catch(err => console.error('[DAC] rounds.create failed', err));

                /**
                 * @note Flushing the state is after the DAC call because I still need the data in the right format for the DB.
                 *      In addition, I wanted to keep everything in the state.
                 *      This works because `DAC.resistance.rounds.createRound()` calls `structuredClone()` on `@state`, so the async race condition here is avoided.
                 * - Joseph Habisohn 4/18/2026
                 */
                state.pendingNominations = [];
                state.pendingMissionCards = {};

                bus.emitInternal('game:ended', {
                    winner,
                    reason: 'mission-victory'
                });
                return;
            }

            state.mission++;

            cameFromMission = true;

            state.phase = 'suspicion';
            this.room.broadcast("suspicion:started", {});
        });

        /**
         * Broadcasts game:ended
         */
        bus.on("game:ended", 100, e => {
            if (state.phase !== 'game-over') return;

            state.endWinner = e.winner;

            // Persist the result. We don't await the bus handler itself, but
            // we do want errors to surface in the logs instead of being lost.
            DAC.resistance.games.id(meta_data.gameid).end(state, e.reason)
                .catch(err => console.error('[DAC] games.end failed', err));

            this.room.broadcast("game:ended", {
                winner: e.winner,
                reason: e.reason
            })

            // Schedule the room for removal after the post-game grace window
            // so the manager doesn't accumulate finished games.
            roomManager.scheduleRemoval(this.room.getJoinCode());
        })
    }

    private buildKnownRoles(playerId: PlayerId, role: RoleName, players: Map<PlayerId, PlayerState>): Record<PlayerId, KnownRole> {
        const known: Record<PlayerId, KnownRole> = {};

        switch (role) {
            case 'spy':
            case 'assassin':
            case 'false-commander':
            case 'deep-cover':
                // spies know all other spies except blind-spy
                for (const other of players.values()) {
                    if (other.playerId === playerId) continue;
                    if (teamOf(other.role!) === 'spy' && other.role !== 'blind-spy') {
                        known[other.playerId] = other.role!;
                    }
                }
                break;

            case 'commander':
                // commander knows all spies except deep-cover
                for (const other of players.values()) {
                    if (other.playerId === playerId) continue;
                    if (teamOf(other.role!) === 'spy' && other.role !== 'deep-cover') {
                        known[other.playerId] = other.role!;
                    }
                }
                break;

            case 'bodyguard':
                // bodyguard knows commander and false-commander as 'commander-candidate'
                for (const other of players.values()) {
                    if (other.playerId === playerId) continue;
                    if (other.role === 'commander' || other.role === 'false-commander') {
                        known[other.playerId] = 'commander-candidate';
                    }
                }
                break;

            case 'blind-spy':
            case 'resistance':
            default:
                break;
        }

        return known;
    }
}