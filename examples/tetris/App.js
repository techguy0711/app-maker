import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  COLS, ROWS, COLORS, createBoard, rotate, randomPiece,
  isValid, merge, clearLines, scoreForLines, levelForLines, dropInterval,
} from './src/engine';

const { width, height } = Dimensions.get('window');
const TOP = (RNStatusBar.currentHeight || 44) + 8;
// Size a cell so the board fits both the width and a sensible slice of height.
const CELL = Math.floor(Math.min((width - 32) / COLS, (height * 0.56) / ROWS));
const BOARD_W = CELL * COLS;
const EMPTY = '#0f172a';

export default function App() {
  const [board, setBoard] = useState(createBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [nextPiece, setNextPiece] = useState(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  // Mirror the latest state into a ref so interval/handlers never go stale.
  const gs = useRef({});
  gs.current = { board, piece, nextPiece, score, lines, level, gameOver, paused };

  function applyState(p) {
    if ('board' in p) setBoard(p.board);
    if ('piece' in p) setPiece(p.piece);
    if ('nextPiece' in p) setNextPiece(p.nextPiece);
    if ('score' in p) setScore(p.score);
    if ('lines' in p) setLines(p.lines);
    if ('level' in p) setLevel(p.level);
    if ('gameOver' in p) setGameOver(p.gameOver);
  }

  // Lock a piece, clear lines, score it, and spawn the next one (or end game).
  function resolveLock(s, lockPiece, extraScore) {
    const { board: nb, cleared } = clearLines(merge(s.board, lockPiece));
    const totalLines = s.lines + cleared;
    const base = {
      board: nb,
      score: s.score + scoreForLines(cleared, s.level) + extraScore,
      lines: totalLines,
      level: levelForLines(totalLines),
    };
    const spawn = s.nextPiece;
    if (!isValid(nb, spawn)) return { ...base, gameOver: true };
    return { ...base, piece: spawn, nextPiece: randomPiece() };
  }

  function drop(isSoft) {
    const s = gs.current;
    if (s.gameOver || s.paused) return;
    const moved = { ...s.piece, row: s.piece.row + 1 };
    if (isValid(s.board, moved)) {
      setPiece(moved);
      if (isSoft) setScore(s.score + 1);
    } else {
      applyState(resolveLock(s, s.piece, 0));
    }
  }

  function move(dx) {
    const s = gs.current;
    if (s.gameOver || s.paused) return;
    const moved = { ...s.piece, col: s.piece.col + dx };
    if (isValid(s.board, moved)) setPiece(moved);
  }

  function rotatePiece() {
    const s = gs.current;
    if (s.gameOver || s.paused) return;
    const rotated = { ...s.piece, matrix: rotate(s.piece.matrix, 1) };
    for (const k of [0, -1, 1, -2, 2]) { // simple wall kicks
      const c = { ...rotated, col: rotated.col + k };
      if (isValid(s.board, c)) { setPiece(c); return; }
    }
  }

  function hardDrop() {
    const s = gs.current;
    if (s.gameOver || s.paused) return;
    let row = s.piece.row;
    while (isValid(s.board, { ...s.piece, row: row + 1 })) row++;
    const dist = row - s.piece.row;
    applyState(resolveLock(s, { ...s.piece, row }, dist * 2));
  }

  function restart() {
    setBoard(createBoard());
    setPiece(randomPiece());
    setNextPiece(randomPiece());
    setScore(0); setLines(0); setLevel(0);
    setGameOver(false); setPaused(false);
  }

  // Gravity: re-armed whenever speed (level) or run state changes.
  const dropRef = useRef(() => {});
  useEffect(() => { dropRef.current = () => drop(false); });
  useEffect(() => {
    if (gameOver || paused) return;
    const id = setInterval(() => dropRef.current(), dropInterval(level));
    return () => clearInterval(id);
  }, [level, gameOver, paused]);

  // Display grid = locked board + the live piece painted on top.
  const display = board.map((r) => r.slice());
  if (!gameOver) {
    const { matrix, row, col, type } = piece;
    for (let r = 0; r < matrix.length; r++)
      for (let c = 0; c < matrix[r].length; c++)
        if (matrix[r][c]) {
          const br = row + r, bc = col + c;
          if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) display[br][bc] = COLORS[type];
        }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>TETRIS</Text>
          <Text style={styles.stat}>Score  {score}</Text>
          <Text style={styles.stat}>Lines  {lines}   Level  {level}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <Preview matrix={nextPiece.matrix} color={COLORS[nextPiece.type]} />
          <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.pauseBtn}>
            <Text style={styles.pauseTxt}>{paused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <View style={[styles.board, { width: BOARD_W }]}>
          {display.map((r, ri) => (
            <View key={ri} style={styles.boardRow}>
              {r.map((cell, ci) => (
                <View
                  key={ci}
                  style={{
                    width: CELL, height: CELL,
                    backgroundColor: cell || EMPTY,
                    borderWidth: 1,
                    borderColor: cell ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.04)',
                  }}
                />
              ))}
            </View>
          ))}
        </View>

        {(gameOver || paused) && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>{gameOver ? 'Game Over' : 'Paused'}</Text>
            {gameOver && <Text style={styles.overlayScore}>Score {score}</Text>}
            {gameOver ? (
              <TouchableOpacity onPress={restart} style={styles.playAgain}>
                <Text style={styles.playAgainTxt}>Play again</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setPaused(false)} style={styles.playAgain}>
                <Text style={styles.playAgainTxt}>Resume</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <Ctrl label="◀" onPress={() => move(-1)} />
          <Ctrl label="⟳" onPress={rotatePiece} />
          <Ctrl label="▶" onPress={() => move(1)} />
        </View>
        <View style={styles.controlRow}>
          <Ctrl label="▼ Soft" flex={1} onPress={() => drop(true)} />
          <Ctrl label="⤓ Drop" flex={1} accent onPress={hardDrop} />
        </View>
      </View>
    </View>
  );
}

function Ctrl({ label, onPress, flex, accent }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.ctrl, accent && styles.ctrlAccent, flex ? { flex } : { width: 92 }]}
    >
      <Text style={styles.ctrlTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function Preview({ matrix, color }) {
  const s = Math.floor(CELL * 0.55);
  return (
    <View style={styles.preview}>
      {matrix.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((v, ci) => (
            <View key={ci} style={{ width: s, height: s, backgroundColor: v ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617', paddingTop: TOP },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  title: { color: '#e2e8f0', fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  stat: { color: '#94a3b8', fontSize: 15, marginTop: 4, fontVariant: ['tabular-nums'] },
  headerRight: { alignItems: 'center' },
  nextLabel: { color: '#64748b', fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  preview: { minHeight: CELL, justifyContent: 'center' },
  pauseBtn: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: '#1e293b', borderRadius: 8,
  },
  pauseTxt: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  boardWrap: { alignItems: 'center', justifyContent: 'center' },
  board: {
    borderWidth: 2, borderColor: '#1e293b', backgroundColor: EMPTY,
    alignSelf: 'center',
  },
  boardRow: { flexDirection: 'row' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.82)',
  },
  overlayTitle: { color: '#f8fafc', fontSize: 34, fontWeight: '800' },
  overlayScore: { color: '#93c5fd', fontSize: 20, marginTop: 8 },
  playAgain: {
    marginTop: 20, backgroundColor: '#3b82f6',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10,
  },
  playAgainTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  controls: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 24 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  ctrl: {
    backgroundColor: '#1e293b', borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
  },
  ctrlAccent: { backgroundColor: '#2563eb' },
  ctrlTxt: { color: '#f1f5f9', fontSize: 22, fontWeight: '700' },
});
