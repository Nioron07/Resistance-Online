// import { TestGameRoom } from "../managers/TestGameRoom.js";

type TestGameData = {
    player_order: string[];
    hands: [
        {
            'left': number;
            'right': number;
        },
        {
            'left': number;
            'right': number;
        }
    ];
    death_type: 'rollover' | 'cutoff'
}

type Q = 'start' | 'one-player' | 'waiting-start' | '0' | '1' | '0w' | '1w';

/**
 * @classdesc
 * 
 * An implementation of the game of chopsticks, implemented as a DFA.
 */
export class TestGameState {
     private static transitions: Record<Q, Record<string, Q>> = {
        'start': {
            'join': 'one-player'
        },
        'one-player': {
            'join': 'waiting-start',
            'leave': 'start'
        },
        'waiting-start': {
            'leave': 'one-player',
            'start-game': '0'
        },
        '0': {
            'next': '1',
            'win': '0w',
            'lose': '1w'
        },
        '1': {
            'next': '0',
            'win': '1w',
            'lose': '0w',
        },
        '0w': {
            'next': '1',
            'win': '0w',
            'lose': '1w'
        },
        '1w': {
            'next': '0',
            'win': '1w',
            'lose': '0w'
        }
    };

    protected current_state: Q;
    protected data: TestGameData;
    
    constructor(death_type: 'rollover' | 'cutoff' = 'rollover') {
        this.current_state = 'start';
        this.data = {
            player_order: [],
            hands: [
                {
                    'left': 1,
                    'right': 1
                },
                {
                    'left': 1,
                    'right': 1
                }
            ],
            death_type: death_type
        };
    }

    addPlayer(username: string): void {
        this.data.player_order.push(username);

        this.delta('join');
    }

    removePlayer(username: string): void {
        this.data.player_order.splice(this.data.player_order.indexOf(username), 1);

        this.delta('leave');
    }

    getCurrentPlayer(): string | undefined {
        switch (this.current_state) {
            case '0':
                return this.data.player_order[0];

            case '1':
                return this.data.player_order[1];
        
            case '0w':
            case '1w':
                return undefined;

            default:
                return this.data.player_order[0];
        }
    }

    getGameData(): TestGameData {
        return this.data;
    }

    /**
     * The transition function for this DFA
     */
    delta(input: any, action?: ['left' | 'right', 'left' | 'right'] | 'transfer' | 'divide'): string | undefined {
        let other_player_idx: 0 | 1 | undefined = undefined;
        if (action !== undefined) {
            switch (this.current_state) {
                case '0':
                    this.handleMove(0, action);
                    other_player_idx = 1;
                    break;

                case '1':
                    this.handleMove(1, action);
                    other_player_idx = 0;
                    break;

                default:
                    break;
            }
        }

        if (other_player_idx !== undefined && this.data.hands[other_player_idx].left == 0 && this.data.hands[other_player_idx].right == 0) {
            const winner = this.getCurrentPlayer();
            this.current_state = TestGameState.transitions[this.current_state]!['win']!; // Hacky type fix for testing is fine
            return winner;
        }
        
        this.current_state = TestGameState.transitions[this.current_state]![input]!; // Hacky type fix for testing is fine
        return undefined;
    }

    /**
     * Using a simplified rule set based on those found in the [wikipedia page](https://en.wikipedia.org/wiki/Chopsticks_(hand_game)) for Chopsticks
     * 
     * There are a few cases are are missing as the 'true' ruleset is out of the scope of the project.
     * 
     * In addition, it is not perfectly safe, since, again, a 'true' game here is not the goal.
     * 
     * Edge cases are being left in as, the point of this is to test websockets in a game like system.
     * @param player The player that is doing the move
     * @param action The players actions
     */
    private handleMove(player: 0 | 1, action: ['left' | 'right', 'left' | 'right'] | 'transfer' | 'divide'): void {
        const hands = this.data.hands[player];
        switch (action) {

            case 'transfer':
                
                /**
                 * @note Simplified
                 * - Joseph Habisohn 2/24/2026
                 */
                if ((hands.left == 3 && hands.right == 1) || (hands.left == 1 && hands.right == 3)) {
                    hands.left = 2;
                    hands.right = 2;
                }

                break;
        
            case 'divide':
                /**
                 * @note Simplified. Only allowing divisions on even numbers.
                 * - Joseph Habisohn 2/24/2026
                 */
                if ((hands.left == 2 || hands.left == 4) && hands.right == 0) {
                    hands.left = hands.left / 2;
                    hands.right = hands.left / 4;
                    
                } else if ((hands.right == 2 || hands.right == 4) && hands.left == 0) {
                    hands.left = hands.right / 2;
                    hands.right = hands.right / 4;
                    
                }

                break;

            default:
                /**
                 * @note Edge Case: Technically speaking, this allows one to skip their turn via attacking an already dead hand.
                 * I elected to ignore fixing this as a perfect implementation of chopsticks is well outside the scope of this project.
                 * - Joseph Habisohn 2/24/2026
                 */
                const hand_number = hands[action[0]];
                const other_hand_number = this.data.hands[1 - player]![action[1]];

                /**
                 * @note This is a very primitive and not scalable version of DLCs; however, it gets the point across.
                 * Eric came up with a design that is far superior, but far outside of the scope of this test game.
                 * - Joseph Habisohn 2/24/2026 
                 */
                if (other_hand_number == 0) return;
                
                if (this.data.death_type == 'cutoff') {
                    if (other_hand_number + hand_number >= 5) {
                        this.data.hands[1 - player]![action[1]] = 0;

                    } else {
                        this.data.hands[1 - player]![action[1]] += hand_number;

                    }
                    
                } else {
                    this.data.hands[1 - player]![action[1]] = (other_hand_number + hand_number) % 5;

                }

                break;
        }
    }
}