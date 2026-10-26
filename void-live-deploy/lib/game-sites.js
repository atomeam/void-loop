/**
 * game-sites: the pages of the games floor of Versus, one table (owner, 2026-10-26: the games floor, Lichess, and "every site gets its own dedicated
 * page"). The floor's leader gets /chess/; each small game site of its lane (lib/tower.js LANES.games) gets a page of its own under /games/<name>/, and
 * /games/ is the hub. tools/game-pages.mjs writes each page's shell from a row; lib/tool-sites.js adds the rows to SITE_PAGES, so lib/toolkit.js (TOOLS)
 * and lib/seo.js (PAGES) read them like the PDF, Kanban and flights rows. Verse's pages name no other site and copy no game's name, art or words: the
 * table names the rival in plain text only, here, as `lane`. Pure data and the ask that reaches the pages.
 */
export const GAME_SITES = Object.freeze([
  { path: '/chess/', tag: 'Play the computer, a friend, puzzles and analysis', short: 'Chess', lane: 'games', card: 'play chess', name: 'Chess', title: 'Chess: play the computer, puzzles, analysis', h1: 'Chess', sprite: true, keep: ['/lib/chess-worker.js', '/lib/chess-engine.js', '/chess/puzzles.json'],
    intro: 'Play the computer at eight levels, a friend on this device or by link, puzzles, and an analysis board with arrows. Clocks, takeback, PGN and FEN in and out. No account, no ads, works offline.',
    does: 'Free chess in your browser: play Verse\'s own engine at eight levels from about 600 to 2000, two players on one device or a friend by link, puzzles, an analysis board with the engine\'s top line and arrows you draw, clocks with increment, takeback, flip, PGN and FEN import and export, and a link that carries the game. No account, no ads, English and German, works offline.',
    asks: ['play chess', 'chess against the computer', 'chess puzzles', 'chess analysis board', 'pgn viewer', 'fen to board', 'two player chess', 'play chess offline'],
    links: [['Play the computer', '/chess/?mode=ai'], ['Puzzles', '/chess/?mode=puzzle'], ['Analysis board', '/chess/?mode=analysis'], ['Two players on one device', '/chess/?mode=two'], ['Blitz 3+2 against level 5', '/chess/?level=5&tc=3%2B2'], ['The Italian Game', '/chess/?mode=analysis&m=e2e4.e7e5.g1f3.b8c6.f1c4']],
    action: { template: '/chess/?mode=analysis&fen={fen}', input: 'fen' }, chips: ['8 computer levels', 'Two players', 'Puzzles', 'Analysis', 'Arrows', 'Clocks', 'Takeback', 'PGN and FEN', 'Share link', 'Offline'] },
  { path: '/games/', tag: 'Seven free games, no account, no ads', short: 'All games', lane: 'games hub', card: 'games', name: 'Games', title: 'Free games: chess, sudoku, mines, solitaire and more', h1: 'Games',
    intro: 'Chess, sudoku, mines, solitaire, a word guess, slide and merge, and checkers: each on a page of its own, free, with no account and no ads, on your device and offline.',
    does: 'Free browser games with no account and no ads: chess against the computer with puzzles and analysis, sudoku, mines, Klondike solitaire, a five-letter word guess, slide and merge, and checkers. Your fastest times and streaks stay on your device; every game works offline.',
    asks: ['free games', 'games no ads', 'browser games offline', 'puzzle games', 'card games', 'board games online free'],
    links: [],
    chips: ['Chess', 'Sudoku', 'Mines', 'Solitaire', 'Word guess', 'Slide and merge', 'Checkers', 'Offline'] },
  { path: '/games/checkers/', tag: 'Against the computer or a friend', short: 'Checkers', lane: 'games: 247checkers.com', card: 'play checkers', name: 'Checkers', title: 'Checkers against the computer or a friend', h1: 'Checkers',
    intro: 'American checkers against the computer at three levels or a friend on this device: forced captures, multi-jumps, kings, undo and hints. On your device, no account.',
    does: 'Free checkers (American rules, English draughts): play the computer at easy, normal or hard, or two players on one device; captures are forced and multi-jumps shown, kings crowned on the far row, undo, a hint, a move count and your wins kept on this device. No account, no ads, works offline.',
    asks: ['checkers', 'play checkers', 'checkers against computer', 'draughts online', 'two player checkers'],
    links: [['Easy', '/games/checkers/?level=easy'], ['Normal', '/games/checkers/?level=normal'], ['Hard', '/games/checkers/?level=hard'], ['Against the computer', '/games/checkers/?mode=ai'], ['Two players', '/games/checkers/?mode=two']], chips: ['3 levels', 'Two players', 'Forced captures', 'Multi-jumps', 'Kings', 'Undo', 'Hint', 'Offline'] },
  { path: '/games/solitaire/', tag: 'Klondike, draw one or three', short: 'Solitaire', lane: 'games: solitaires.com', card: 'solitaire', name: 'Klondike solitaire', title: 'Klondike solitaire: draw one or three', h1: 'Klondike solitaire',
    intro: 'Klondike patience: draw one or three, tap a card to send it where it goes, drag it, or double-tap it home. Undo, hints, auto-finish, a timer, moves and a score. A numbered deal can be restarted or shared.',
    does: 'Free Klondike solitaire: draw one or draw three, tap or drag cards, double-tap to send a card to the foundation, unlimited undo, a hint, auto-finish, a timer, moves and standard scoring, a numbered deal you can replay or share, and your wins and fastest times on this device. No account, no ads, works offline.',
    asks: ['solitaire', 'klondike solitaire', 'solitaire draw 3', 'free solitaire no ads', 'patience card game'],
    links: [['Draw one', '/games/solitaire/?draw=1'], ['Draw three', '/games/solitaire/?draw=3'], ['Deal 1', '/games/solitaire/?deal=1'], ['Deal 2', '/games/solitaire/?deal=2'], ['Deal 3, draw three', '/games/solitaire/?deal=3&draw=3']], chips: ['Draw 1 or 3', 'Tap or drag', 'Undo', 'Hint', 'Auto-finish', 'Timer', 'Score', 'Deal numbers', 'Offline'] },
  { path: '/games/mines/', tag: 'Clear the field, the first square is safe', short: 'Mines', lane: 'games: minesweeperonline.com', card: 'minesweeper', name: 'Mines', title: 'Mines: clear the field without opening a mine', h1: 'Mines',
    intro: 'Open every safe square: a number says how many of its eight neighbours hide a mine. Beginner, intermediate, expert or your own size; flag by long-press or right-click, chord on a number. The first square is always safe.',
    does: 'Free mine-clearing puzzle: beginner 9x9 with 10 mines, intermediate 16x16 with 40, expert 30x16 with 99, or a custom field; flags and question marks, chording on numbers, a first click that is always safe, a timer and mine counter, fastest times per level on this device, and a numbered board to share. No account, no ads, works offline.',
    asks: ['minesweeper', 'mines game', 'minesweeper expert', 'minesweeper online free', 'mine clearing game'],
    links: [['Beginner', '/games/mines/?level=beginner'], ['Intermediate', '/games/mines/?level=intermediate'], ['Expert', '/games/mines/?level=expert'], ['Custom 20 x 12, 40 mines', '/games/mines/?level=custom&w=20&h=12&m=40'], ['Expert board 1', '/games/mines/?level=expert&board=1']], chips: ['Beginner', 'Intermediate', 'Expert', 'Custom', 'Flags', 'Chording', 'Safe first click', 'Best times', 'Offline'] },
  { path: '/games/word/', tag: 'Guess the five-letter word in six tries', short: 'Word guess', lane: 'games: wordleunlimited.org', card: 'word guess game', name: 'Hidden word', title: 'Hidden word: guess the five-letter word in six tries', h1: 'Hidden word',
    intro: 'Guess the five-letter word in six tries. After each guess a letter turns green when it is in the right place, gold when it is in the word somewhere else, and grey when it is not in it. Play as many as you like, or the word of the day.',
    does: 'Free five-letter word guessing game with Verse\'s own word list: six tries, green for the right place, gold for in the word, grey for not in it, an on-screen and real keyboard, unlimited games and a word of the day, a hard mode, colour-blind colours, your streak and guess spread on this device, and a share line of squares that gives nothing away. No account, no ads, works offline.',
    asks: ['word guess game', 'five letter word game', 'guess the word in six tries', 'word puzzle unlimited', 'daily word game'],
    links: [['Word of the day', '/games/word/?daily=1'], ['Unlimited', '/games/word/?hard=0'], ['Hard mode', '/games/word/?hard=1'], ['Word of the day, hard', '/games/word/?daily=1&hard=1'], ['Auf Deutsch', '/games/word/?lang=de']], chips: ['6 tries', 'Unlimited', 'Word of the day', 'Hard mode', 'Colour-blind colours', 'Streaks', 'Share', 'Offline'] },
  { path: '/games/sudoku/', tag: 'Easy to evil, one solution each', short: 'Sudoku', lane: 'games: websudoku.com', card: 'sudoku', name: 'Sudoku', title: 'Sudoku: easy to evil, with notes and hints', h1: 'Sudoku',
    intro: 'Fill the grid so every row, column and 3x3 box holds 1 to 9 once. Four levels from easy to evil, each puzzle with exactly one answer. Pencil notes, undo, a hint that says why, mistakes shown if you like, a timer, and print.',
    does: 'Free sudoku with four levels (easy, medium, hard, evil), every puzzle made on your device with exactly one solution: pencil notes, undo and redo, a hint that names the reason, show mistakes on or off, highlight of the same number, a timer, a numbered puzzle to share or print, and fastest times on this device. No account, no ads, works offline.',
    asks: ['sudoku', 'sudoku online', 'evil sudoku', 'sudoku with pencil marks', 'printable sudoku', 'easy sudoku'],
    links: [['Easy', '/games/sudoku/?level=easy'], ['Medium', '/games/sudoku/?level=medium'], ['Hard', '/games/sudoku/?level=hard'], ['Evil', '/games/sudoku/?level=evil'], ['Evil puzzle 1', '/games/sudoku/?level=evil&puzzle=1']], chips: ['Easy to evil', 'One solution', 'Notes', 'Undo', 'Hints', 'Mistakes', 'Timer', 'Print', 'Offline'] },
  { path: '/games/merge/', tag: 'Slide, join equal tiles, reach 2048', short: 'Slide and merge', lane: 'games: play2048.co', card: 'play 2048', name: 'Slide and merge', title: 'Slide and merge: join equal tiles to double them', h1: 'Slide and merge',
    intro: 'Slide every tile one way with the arrow keys or a swipe; two equal tiles that meet join into one of double the value. Reach 2048 and keep going. Undo one move, your top score on this device.',
    does: 'Free sliding tile puzzle on a 4x4 grid: swipe or use the arrow keys (or WASD), equal tiles join and double, a new 2 or 4 after each move, score and top score, reach 2048 and keep going, undo, a seeded game to share, and smooth moves that respect reduced motion. No account, no ads, works offline.',
    asks: ['2048 game', 'slide and merge tiles', 'tile merging puzzle', 'number sliding game', 'swipe tiles game'],
    links: [['Game 1', '/games/merge/?seed=1'], ['Game 2', '/games/merge/?seed=2'], ['Game 7', '/games/merge/?seed=7'], ['Game 42', '/games/merge/?seed=42'], ['Game 2048', '/games/merge/?seed=2048']], chips: ['Swipe or keys', 'Score', 'Top score', 'Undo', 'Keep going', 'Share', 'Offline'] },
]);
/** the games page an ask names (on the tool pages' ask bar), or ''. Pure. */
export function gameAskOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?.!]+$/, '');
  if (/^(?:free |online |browser )?games?(?: page| list| hub)?$|^(?:all|every) games$/.test(t)) return '/games/';
  if (/^chess puzzles?$|^(?:a |daily )?chess puzzle$|^chess tactics$/.test(t)) return '/chess/?mode=puzzle';
  if (/^(?:chess )?analysis board$|^pgn (?:viewer|reader)$|^fen (?:viewer|to board)$/.test(t)) return '/chess/?mode=analysis';
  if (/^(?:two|2) player chess$|^chess (?:with|against) a friend$/.test(t)) return '/chess/?mode=two';
  if (/^(?:play )?chess(?: online| page| against (?:the )?computer| vs computer| with (?:a )?clock)?$/.test(t)) return '/chess/';
  if (/^(?:play )?(?:checkers|draughts)(?: online| against (?:the )?computer)?$/.test(t)) return '/games/checkers/';
  if (/^(?:play )?(?:klondike )?solitaire(?: online| draw [13])?$|^patience$/.test(t)) return '/games/solitaire/';
  if (/^(?:play )?(?:minesweeper|mines)(?: online| game| expert| beginner)?$/.test(t)) return '/games/mines/';
  if (/^(?:play )?sudoku(?: online| easy| medium| hard| evil)?$/.test(t)) return '/games/sudoku/';
  if (/^(?:play )?2048(?: game)?$|^slide and merge$/.test(t)) return '/games/merge/';
  if (/^(?:five|5) letter word (?:game|guess)$|^word guess(?:ing)? game$|^(?:hidden word|wordle)(?: unlimited)?$/.test(t)) return '/games/word/';
  return '';
}
