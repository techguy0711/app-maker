const e = require('./src/engine.js');
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL:', name); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Board shape
const b = e.createBoard();
check('board has 20 rows', b.length === 20);
check('board rows have 10 cols', b.every(r => r.length === 10));
check('board starts empty', b.every(r => r.every(c => c === null)));

// Rotation of T (clockwise)
const t = e.SHAPES.T;
const tCW = e.rotate(t, 1);
check('T rotates clockwise correctly', eq(tCW, [[0,1,0],[0,1,1],[0,1,0]]));
// 4 rotations return to start
check('4x rotate = identity', eq(e.rotate(e.rotate(e.rotate(e.rotate(t)))), t));
// O is rotation-invariant
check('O rotation invariant', eq(e.rotate(e.SHAPES.O), e.SHAPES.O));

// Validity / collision
const oPiece = e.spawnPiece('O');
check('spawn O is valid on empty board', e.isValid(b, oPiece));
check('off left edge invalid', !e.isValid(b, {...oPiece, col: -1}));
check('off right edge invalid', !e.isValid(b, {...oPiece, col: 9}));
check('below floor invalid', !e.isValid(b, {...oPiece, row: 19}));

// Merge + single line clear
let board = e.createBoard();
board[19] = new Array(10).fill('#fff'); // full bottom row
const cleared1 = e.clearLines(board);
check('one full row clears', cleared1.cleared === 1);
check('board still 20 rows after clear', cleared1.board.length === 20);
check('board empty after clearing the only row', cleared1.board.every(r => r.every(c => c === null)));

// Two-row clear with a survivor above that should fall
board = e.createBoard();
board[18] = new Array(10).fill('#fff');
board[19] = new Array(10).fill('#fff');
board[17][3] = '#abc'; // lone survivor
const cleared2 = e.clearLines(board);
check('two full rows clear', cleared2.cleared === 2);
check('survivor drops to bottom row', cleared2.board[19][3] === '#abc');
check('rows above survivor are empty', cleared2.board[18].every(c => c === null));

// Merge writes the piece color
const merged = e.merge(e.createBoard(), e.spawnPiece('O'));
const filled = merged.flat().filter(c => c !== null);
check('merge fills exactly 4 cells (O)', filled.length === 4);
check('merge uses the O color', filled.every(c => c === e.COLORS.O));

// Scoring
check('single line score', e.scoreForLines(1, 0) === 40);
check('tetris score', e.scoreForLines(4, 0) === 1200);
check('tetris score scales with level', e.scoreForLines(4, 4) === 6000);
check('zero lines = zero score', e.scoreForLines(0, 5) === 0);

// Level + speed
check('level from lines', e.levelForLines(25) === 2);
check('speed decreases with level', e.dropInterval(0) > e.dropInterval(5));
check('speed has a floor of 80ms', e.dropInterval(100) === 80);

// Game over: occupied spawn cell makes the new piece invalid
const go = e.createBoard();
go[0][4] = '#fff'; // O spawns at col 4-5, row 0-1
check('game over detected (spawn blocked)', !e.isValid(go, e.spawnPiece('O')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
