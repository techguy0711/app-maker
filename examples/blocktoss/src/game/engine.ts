/**
 * Block Toss physics. Pure TypeScript — no React, no react-native — so the
 * rules of the game can be reasoned about and tested on their own, separately
 * from how they're drawn.
 *
 * Deliberate simplification: collisions use each block's upright bounding box
 * even while the block is drawn rotated. Real rotated-box collision is a lot
 * more code and, at this size and speed, indistinguishable to a player. The
 * rotation is honest visual feedback for angular momentum the block really
 * has; it just doesn't feed back into contact tests.
 */

export const GRAVITY = 1600;      // px/s²
export const GROUND_BOUNCE = 0.28; // energy kept on landing
export const FRICTION = 0.86;      // horizontal damping while touching ground
export const SPIN_DAMP = 0.90;     // angular damping while touching ground
export const MAX_SHOTS = 6;

/** How far / how much a block must move before it counts as knocked down. */
export const DOWN_DISTANCE = 26;   // px from where it started
export const DOWN_ANGLE = 0.42;    // radians (~24°)

export type Block = {
  id: number;
  x: number; y: number;          // centre
  w: number; h: number;
  vx: number; vy: number;
  angle: number; spin: number;
  startX: number; startY: number;
  down: boolean;
};

export type Ball = { x: number; y: number; r: number; vx: number; vy: number };

export type World = {
  width: number;
  height: number;
  groundY: number;
  blocks: Block[];
  ball: Ball | null;
  shotsLeft: number;
  knocked: number;
  won: boolean;
  lost: boolean;
  /** True once the first shot has been fired. Nothing counts as knocked
   *  down before then — a tower at rest still jitters by fractions of a
   *  pixel as contacts resolve, and without this the game opens claiming
   *  most of the blocks are already down. */
  started: boolean;
};

export type Layout = { width: number; height: number };

/**
 * Build a fresh tower. Blocks rest exactly on the ground and on each other,
 * with no gaps — a stack that settles on frame one would make the opening
 * screen a moving target for the visual check and, worse, look wobbly to a
 * player before they've touched anything.
 */
export function createWorld({ width, height }: Layout): World {
  const groundY = height - 28;
  const bw = Math.max(34, Math.min(46, width * 0.11));
  const bh = bw * 0.62;
  const cols = 3;
  const rows = 4;
  const towerRight = width - 26;
  const towerLeft = towerRight - cols * bw;

  const blocks: Block[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = towerLeft + bw * c + bw / 2;
      const y = groundY - bh / 2 - r * bh;
      blocks.push({
        id: id++, x, y, w: bw, h: bh,
        vx: 0, vy: 0, angle: 0, spin: 0,
        startX: x, startY: y, down: false,
      });
    }
  }

  return {
    width, height, groundY, blocks, ball: null,
    shotsLeft: MAX_SHOTS, knocked: 0, won: false, lost: false, started: false,
  };
}

export function launch(world: World, originX: number, originY: number, angle: number, speed: number): World {
  if (world.ball || world.shotsLeft <= 0 || world.won) return world;
  return {
    ...world,
    started: true,
    shotsLeft: world.shotsLeft - 1,
    ball: {
      x: originX, y: originY, r: 9,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
    },
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Advance the world by dt seconds. Mutates in place and returns the world. */
export function step(world: World, dt: number): World {
  // Fixed maximum sub-step. A long frame (a slow phone, a backgrounded app)
  // would otherwise let a fast ball teleport straight through a block.
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) integrate(world, h);

  world.knocked = world.blocks.filter(b => b.down).length;
  world.won = world.knocked === world.blocks.length;
  world.lost = !world.won && world.shotsLeft === 0 && !world.ball && atRest(world);
  return world;
}

function atRest(world: World): boolean {
  return world.blocks.every(b => Math.abs(b.vx) < 4 && Math.abs(b.vy) < 4);
}

function integrate(world: World, h: number) {
  const { blocks } = world;

  // --- ball ---------------------------------------------------------------
  if (world.ball) {
    const ball = world.ball;
    ball.vy += GRAVITY * h;
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;

    for (const b of blocks) {
      if (!overlapsCircle(ball, b)) continue;
      // Push the block along the ball's travel and spin it about the point
      // it was struck: hitting high or off-centre topples, hitting dead
      // centre shoves. That difference is the whole skill of the game.
      const impulse = Math.hypot(ball.vx, ball.vy) * 0.55;
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      b.vx += Math.sign(ball.vx || dx || 1) * impulse * 0.8;
      b.vy += Math.min(0, ball.vy) * 0.25 - Math.abs(impulse) * 0.12;
      b.spin += (-dy / b.h) * impulse * 0.05 * Math.sign(ball.vx || 1);
      ball.vx *= 0.42;
      ball.vy = ball.vy * 0.42 - 60;
      break;
    }

    const gone = ball.x - ball.r > world.width || ball.x + ball.r < 0 || ball.y - ball.r > world.height;
    const stopped = ball.y + ball.r >= world.groundY && Math.abs(ball.vx) < 30;
    if (gone || stopped) {
      world.ball = null;
    } else if (ball.y + ball.r > world.groundY) {
      ball.y = world.groundY - ball.r;
      ball.vy = -ball.vy * 0.35;
      ball.vx *= 0.7;
    }
  }

  // --- blocks -------------------------------------------------------------
  for (const b of blocks) {
    b.vy += GRAVITY * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.angle += b.spin * h;

    // walls
    const half = b.w / 2;
    if (b.x - half < 0) { b.x = half; b.vx = -b.vx * 0.4; }
    if (b.x + half > world.width) { b.x = world.width - half; b.vx = -b.vx * 0.4; }

    // ground
    const bottom = b.y + b.h / 2;
    if (bottom > world.groundY) {
      b.y = world.groundY - b.h / 2;
      b.vy = b.vy > 0 ? -b.vy * GROUND_BOUNCE : b.vy;
      if (Math.abs(b.vy) < 30) b.vy = 0;
      b.vx *= FRICTION;
      b.spin *= SPIN_DAMP;
      if (Math.abs(b.vx) < 3) b.vx = 0;
      if (Math.abs(b.spin) < 0.05) b.spin = 0;
    }

    b.spin = clamp(b.spin, -9, 9);
    b.angle = clamp(b.angle, -Math.PI, Math.PI);
  }

  // block-on-block: resolve along the shallower overlap axis, which is what
  // keeps a tower standing instead of squeezing through itself.
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      resolvePair(blocks[i], blocks[j]);
    }
  }

  if (world.started) {
    for (const b of blocks) {
      if (b.down) continue;
      const moved = Math.hypot(b.x - b.startX, b.y - b.startY);
      if (moved > DOWN_DISTANCE || Math.abs(b.angle) > DOWN_ANGLE) b.down = true;
    }
  }
}

function overlapsCircle(ball: Ball, b: Block): boolean {
  const nx = clamp(ball.x, b.x - b.w / 2, b.x + b.w / 2);
  const ny = clamp(ball.y, b.y - b.h / 2, b.y + b.h / 2);
  return (ball.x - nx) ** 2 + (ball.y - ny) ** 2 <= ball.r ** 2;
}

function resolvePair(a: Block, b: Block) {
  const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
  const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
  // SLOP, not 0. Stacked blocks touch exactly, so floating-point noise makes
  // the overlap flicker a hair above zero every frame; resolving that pushes
  // the tower apart and spins it while nobody is playing.
  const SLOP = 0.5;
  if (ox <= SLOP || oy <= SLOP) return;

  if (oy < ox) {
    const push = (oy / 2) * (a.y < b.y ? -1 : 1);
    a.y += push; b.y -= push;
    const avg = (a.vy + b.vy) / 2;
    a.vy = avg * 0.5; b.vy = avg * 0.5;
    a.vx *= 0.94; b.vx *= 0.94;
  } else {
    const push = (ox / 2) * (a.x < b.x ? -1 : 1);
    a.x += push; b.x -= push;
    const avg = (a.vx + b.vx) / 2;
    a.vx = avg * 0.7; b.vx = avg * 0.7;
    // Only impart spin on a real shove. Contact resolution between resting
    // neighbours must not generate rotation out of nothing.
    if (Math.abs(a.vx - b.vx) > 40) a.spin += 0.4 * Math.sign(push || 1);
  }
}
