// Pure Tetris engine — no React in here, so it can be unit-tested in Node
// and reused by the UI. All functions return NEW state, never mutate input.

const COLS = 10;
const ROWS = 20;

// Spawn orientations. Square matrices keep rotation trivial.
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

const COLORS = {
  I: '#38bdf8', O: '#facc15', T: '#a855f7',
  S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316',
};

const TYPES = Object.keys(SHAPES);

function createBoard() {
  const board = [];
  for (let r = 0; r < ROWS; r++) board.push(new Array(COLS).fill(null));
  return board;
}

function cloneMatrix(m) { return m.map((row) => row.slice()); }

// Rotate a square matrix 90°. dir = 1 clockwise, -1 counter-clockwise.
function rotate(matrix, dir = 1) {
  const n = matrix.length;
  const result = matrix.map((row) => row.slice());
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dir === 1) result[c][n - 1 - r] = matrix[r][c];
      else result[n - 1 - c][r] = matrix[r][c];
    }
  }
  return result;
}

function spawnPiece(type) {
  const matrix = cloneMatrix(SHAPES[type]);
  const col = Math.floor((COLS - matrix[0].length) / 2);
  return { type, matrix, row: 0, col };
}

function randomPiece() {
  return spawnPiece(TYPES[Math.floor(Math.random() * TYPES.length)]);
}

// Is the piece in a legal spot? Rows above the top (br < 0) are allowed.
function isValid(board, piece) {
  const { matrix, row, col } = piece;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const br = row + r, bc = col + c;
      if (bc < 0 || bc >= COLS) return false;
      if (br >= ROWS) return false;
      if (br >= 0 && board[br][bc] !== null) return false;
    }
  }
  return true;
}

// Lock a piece into a NEW board.
function merge(board, piece) {
  const next = board.map((row) => row.slice());
  const { matrix, row, col, type } = piece;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const br = row + r, bc = col + c;
      if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) next[br][bc] = COLORS[type];
    }
  }
  return next;
}

// Remove full rows; gravity pulls the rest down. Returns { board, cleared }.
function clearLines(board) {
  const kept = board.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - kept.length;
  const top = [];
  for (let i = 0; i < cleared; i++) top.push(new Array(COLS).fill(null));
  return { board: top.concat(kept), cleared };
}

const LINE_SCORES = [0, 40, 100, 300, 1200]; // classic 1/2/3/4-line values
function scoreForLines(cleared, level) {
  return (LINE_SCORES[cleared] || 0) * (level + 1);
}

function levelForLines(totalLines) { return Math.floor(totalLines / 10); }

// Gravity delay (ms). Smaller = faster as the level climbs.
function dropInterval(level) { return Math.max(800 - level * 70, 80); }

module.exports = {
  COLS, ROWS, SHAPES, COLORS, TYPES,
  createBoard, rotate, spawnPiece, randomPiece,
  isValid, merge, clearLines, scoreForLines, levelForLines, dropInterval,
};
