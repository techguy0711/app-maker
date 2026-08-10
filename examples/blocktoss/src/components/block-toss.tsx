import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { createWorld, launch, step, type World } from '@/game/engine';

const BOT_SIZE = 76;
const HUD_HEIGHT = 96;
const AIM_MIN = 0.20;   // radians above horizontal
const AIM_MAX = 1.15;
const AIM_SPEED = 1.5;  // radians per second
const LAUNCH_SPEED = 720;

export function BlockToss() {
  const { width, height } = useWindowDimensions();
  const arena = { width, height: Math.max(240, height - HUD_HEIGHT - 120) };

  const [world, setWorld] = useState<World>(() => createWorld(arena));
  const [aim, setAim] = useState(0.6);

  const worldRef = useRef(world);
  const aimRef = useRef({ value: 0.6, dir: 1 });
  worldRef.current = world;

  const reset = useCallback(() => {
    const fresh = createWorld(arena);
    worldRef.current = fresh;
    setWorld(fresh);
  }, [arena.width, arena.height]);

  // Rebuild when the screen size changes (rotation, or a different phone).
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arena.width, arena.height]);

  // One animation loop for both the physics and the swinging aim. Driving
  // them from the same clock keeps the aim line pointing exactly where the
  // next shot will actually go.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;

      if (dt > 0) {
        const a = aimRef.current;
        a.value += a.dir * AIM_SPEED * dt;
        if (a.value > AIM_MAX) { a.value = AIM_MAX; a.dir = -1; }
        if (a.value < AIM_MIN) { a.value = AIM_MIN; a.dir = 1; }
        setAim(a.value);
        setWorld({ ...step(worldRef.current, dt) });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fire = useCallback(() => {
    const w = worldRef.current;
    const next = launch(w, BOT_SIZE * 0.9, w.height - 64, aimRef.current.value, LAUNCH_SPEED);
    worldRef.current = next;
    setWorld(next);
  }, []);

  const total = world.blocks.length;
  const canFire = !world.ball && world.shotsLeft > 0 && !world.won;

  return (
    <View style={styles.root}>
      <View style={styles.hud} testID="hud">
        <View style={styles.hudBlock}>
          <ThemedText style={styles.hudNumber}>{world.knocked}/{total}</ThemedText>
          <ThemedText style={styles.hudLabel}>knocked down</ThemedText>
        </View>
        <View style={styles.hudBlock}>
          <ThemedText style={styles.hudNumber}>{world.shotsLeft}</ThemedText>
          <ThemedText style={styles.hudLabel}>shots left</ThemedText>
        </View>
        <Pressable style={styles.reset} onPress={reset} testID="reset" accessibilityRole="button">
          <ThemedText style={styles.resetText}>Start over</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.arena, { height: arena.height }]} testID="arena">
        {world.blocks.map(b => (
          <View
            key={b.id}
            testID={`block-${b.id}`}
            style={[
              styles.block,
              {
                width: b.w,
                height: b.h,
                left: b.x - b.w / 2,
                top: b.y - b.h / 2,
                backgroundColor: b.down ? '#cbd5e1' : '#f59e0b',
                transform: [{ rotate: `${b.angle}rad` }],
              },
            ]}
          />
        ))}

        {world.ball ? (
          <View
            testID="ball"
            style={[
              styles.ball,
              { left: world.ball.x - world.ball.r, top: world.ball.y - world.ball.r,
                width: world.ball.r * 2, height: world.ball.r * 2, borderRadius: world.ball.r },
            ]}
          />
        ) : null}

        {canFire ? (
          <View
            testID="aim"
            style={[
              styles.aim,
              { left: BOT_SIZE * 0.9, top: arena.height - 66, transform: [{ rotate: `${-aim}rad` }], pointerEvents: 'none' },
            ]}
          />
        ) : null}

        <Pressable
          onPress={fire}
          disabled={!canFire}
          testID="launch-bot"
          accessibilityRole="button"
          accessibilityLabel="Tap to launch"
          style={[styles.bot, { top: arena.height - BOT_SIZE - 28 }, !canFire && styles.botIdle]}>
          <View style={styles.botFace}>
            <View style={styles.eyeRow}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            <View style={styles.mouth} />
          </View>
        </Pressable>

        <View style={styles.ground} testID="ground" />
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText} testID="status">
          {world.won
            ? 'All down. Nice shot.'
            : world.lost
              ? 'Out of shots — tap Start over.'
              : 'Tap the robot when the arrow points where you want.'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hud: {
    height: HUD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  hudBlock: { alignItems: 'flex-start' },
  hudNumber: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  hudLabel: { fontSize: 12, opacity: 0.6, lineHeight: 16 },
  reset: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
  },
  resetText: { fontSize: 14, fontWeight: '600', color: '#0f172a', lineHeight: 18 },

  arena: { width: '100%', position: 'relative', overflow: 'hidden' },
  block: { position: 'absolute', borderRadius: 4 },
  ball: { position: 'absolute', backgroundColor: '#0ea5e9' },
  aim: {
    position: 'absolute',
    width: 78,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0ea5e9',
    opacity: 0.55,
  },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, backgroundColor: '#94a3b8' },

  bot: {
    position: 'absolute',
    left: 16,
    width: BOT_SIZE,
    height: BOT_SIZE,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botIdle: { opacity: 0.45 },
  botFace: { alignItems: 'center', gap: 10 },
  eyeRow: { flexDirection: 'row', gap: 12 },
  eye: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  mouth: { width: 30, height: 5, borderRadius: 3, backgroundColor: '#fff', opacity: 0.85 },

  footer: { paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  footerText: { fontSize: 14, textAlign: 'center', opacity: 0.75, lineHeight: 20 },
});
