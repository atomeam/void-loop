/**
 * games skill — every board and table game as one family (Adam, 2026-10-15: "board games can all be combined"): one place in
 * the routing order, one picker (rack: "games", "play a game", "games card"), one Verse strength for all of them
 * (skills/game-level.js, set on the picker), one 3D renderer (skills/scene3d.js, each board a miniature in skills/mini/) and
 * one card frame (skills/side-card.js). Every old name still opens its game ("play chess", "connect 4", "play solar quest" ->
 * VoidQuest), asked in the members' old order (lib/skill-family.js), and the page still logs skill:<member>.
 * Names stay trademark-free per domains/void.board-game-law.md (Four in a Row, Reversi, Sea Battle, The Landlord's Game, VoidQuest).
 * parts: ['aggravation', 'sorry', 'connect4', 'ringer', 'tictactoe', 'othello', 'mancala', 'chess', 'checkers', 'go', 'monopoly', 'battleship', 'poker', 'fireworks', 'rack', 'eightball']
 */
import { family } from '../lib/skill-family.js';
import aggravation from './aggravation.js';
import sorry from './sorry.js';
import connect4 from './connect4.js';
import ringer from './ringer.js';
import tictactoe from './tictactoe.js';
import othello from './othello.js';
import mancala from './mancala.js';
import chess from './chess.js';
import checkers from './checkers.js';
import go from './go.js';
import monopoly from './monopoly.js';
import battleship from './battleship.js';
import poker from './poker.js';
import fireworks from './fireworks.js';
import rack from './rack.js';
import eightball from './eightball.js';

export default family('games', [aggravation, sorry, connect4, ringer, tictactoe, othello, mancala, chess, checkers, go, monopoly, battleship, poker, fireworks, rack, eightball]);
