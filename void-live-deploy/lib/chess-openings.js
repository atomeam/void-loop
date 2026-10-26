/**
 * chess-openings: the common openings by name, for /chess/'s move list (owner, 2026-10-26: the games floor). Each is the usual name of a move
 * order and its ECO code, written here from general chess knowledge (no opening database copied). openingOf(sans) names the longest one the game
 * starts with. Pure.
 */
const BOOK = [
  ['A00', 'Uncommon opening', ''], ['A04', 'Réti Opening', 'Nf3'], ['A10', 'English Opening', 'c4'], ['A40', 'Queen\'s Pawn Game', 'd4'], ['B00', 'King\'s Pawn Game', 'e4'],
  ['C20', 'Open Game', 'e4 e5'], ['C40', 'King\'s Knight Opening', 'e4 e5 Nf3'], ['C44', 'King\'s Pawn Game: Nc6', 'e4 e5 Nf3 Nc6'], ['C60', 'Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5'],
  ['C68', 'Ruy Lopez: Exchange Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6'], ['C70', 'Ruy Lopez: Morphy Defence', 'e4 e5 Nf3 Nc6 Bb5 a6'], ['C65', 'Ruy Lopez: Berlin Defence', 'e4 e5 Nf3 Nc6 Bb5 Nf6'],
  ['C84', 'Ruy Lopez: Closed', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'], ['C50', 'Italian Game', 'e4 e5 Nf3 Nc6 Bc4'], ['C53', 'Italian Game: Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3'],
  ['C55', 'Italian Game: Two Knights Defence', 'e4 e5 Nf3 Nc6 Bc4 Nf6'], ['C51', 'Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'], ['C45', 'Scotch Game', 'e4 e5 Nf3 Nc6 d4'], ['C46', 'Four Knights Game', 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
  ['C42', 'Petrov\'s Defence', 'e4 e5 Nf3 Nf6'], ['C41', 'Philidor Defence', 'e4 e5 Nf3 d6'], ['C30', 'King\'s Gambit', 'e4 e5 f4'], ['C23', 'Bishop\'s Opening', 'e4 e5 Bc4'], ['C25', 'Vienna Game', 'e4 e5 Nc3'],
  ['B20', 'Sicilian Defence', 'e4 c5'], ['B27', 'Sicilian Defence', 'e4 c5 Nf3'], ['B33', 'Sicilian Defence: Open', 'e4 c5 Nf3 Nc6 d4'], ['B50', 'Sicilian Defence', 'e4 c5 Nf3 d6'], ['B90', 'Sicilian Defence: Najdorf Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
  ['B70', 'Sicilian Defence: Dragon Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'], ['B22', 'Sicilian Defence: Alapin Variation', 'e4 c5 c3'], ['B23', 'Sicilian Defence: Closed', 'e4 c5 Nc3'],
  ['C00', 'French Defence', 'e4 e6'], ['C01', 'French Defence: Exchange Variation', 'e4 e6 d4 d5 exd5'], ['C02', 'French Defence: Advance Variation', 'e4 e6 d4 d5 e5'], ['C10', 'French Defence', 'e4 e6 d4 d5 Nc3'],
  ['B10', 'Caro-Kann Defence', 'e4 c6'], ['B12', 'Caro-Kann Defence: Advance Variation', 'e4 c6 d4 d5 e5'], ['B01', 'Scandinavian Defence', 'e4 d5'], ['B07', 'Pirc Defence', 'e4 d6 d4 Nf6 Nc3 g6'], ['B06', 'Modern Defence', 'e4 g6'], ['B02', 'Alekhine\'s Defence', 'e4 Nf6'],
  ['D00', 'Queen\'s Pawn Game', 'd4 d5'], ['D02', 'London System', 'd4 d5 Nf3 Nf6 Bf4'], ['A48', 'London System', 'd4 Nf6 Nf3 g6 Bf4'], ['D06', 'Queen\'s Gambit', 'd4 d5 c4'], ['D20', 'Queen\'s Gambit Accepted', 'd4 d5 c4 dxc4'],
  ['D30', 'Queen\'s Gambit Declined', 'd4 d5 c4 e6'], ['D10', 'Slav Defence', 'd4 d5 c4 c6'], ['A45', 'Indian Defence', 'd4 Nf6'], ['E60', 'King\'s Indian Defence', 'd4 Nf6 c4 g6'], ['E61', 'King\'s Indian Defence', 'd4 Nf6 c4 g6 Nc3 Bg7'],
  ['D80', 'Grünfeld Defence', 'd4 Nf6 c4 g6 Nc3 d5'], ['E20', 'Nimzo-Indian Defence', 'd4 Nf6 c4 e6 Nc3 Bb4'], ['E12', 'Queen\'s Indian Defence', 'd4 Nf6 c4 e6 Nf3 b6'], ['E00', 'Catalan Opening', 'd4 Nf6 c4 e6 g3'],
  ['A80', 'Dutch Defence', 'd4 f5'], ['A56', 'Benoni Defence', 'd4 Nf6 c4 c5'], ['A57', 'Benko Gambit', 'd4 Nf6 c4 c5 d5 b5'], ['A20', 'English Opening: King\'s English', 'c4 e5'], ['A30', 'English Opening: Symmetrical', 'c4 c5'], ['A02', 'Bird\'s Opening', 'f4'],
];
const LINES = BOOK.map(([eco, name, line]) => ({ eco, name, line: line ? line.split(' ') : [] })).sort((a, b) => b.line.length - a.line.length);
/** the opening a game's moves start with: { eco, name } of the longest named line it follows, or null before the first move. */
export function openingOf(sans) { if (!sans.length) return null; const hit = LINES.find((o) => o.line.length && o.line.length <= sans.length && o.line.every((m, i) => sans[i] === m)); return hit ? { eco: hit.eco, name: hit.name } : { eco: 'A00', name: 'Uncommon opening' }; }
