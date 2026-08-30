/**
 * Headless visual-check config. Installed to .claude/visual/vitest.config.ts
 * by scripts/setup-visual-loop.sh — it is agent infrastructure, not part of
 * the user's app, and .claude/ is gitignored.
 *
 * Run it via scripts/ui-validate.sh, never directly.
 *
 * What this renders is react-native-web in Chromium, NOT iOS or Android.
 * It reliably catches structural layout breakage — clipped content, collapsed
 * containers, overflow, unreachable tap targets — and reliably does NOT catch
 * platform-specific rendering. Treat a pass as "the layout is structurally
 * sound", never as "this is what the phone shows".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const stubs = fileURLToPath(new URL('./expo-stubs.tsx', import.meta.url));

// tsconfig maps `@/*` to `./src/*` on templates that use a src/ directory
// (SDK 57's default does) and to `./*` on those that don't. Getting this
// wrong makes every single import fail with a module-not-found that looks
// nothing like a layout problem.
const srcRoot = fs.existsSync(path.join(projectRoot, 'src'))
  ? path.join(projectRoot, 'src')
  : projectRoot;

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  resolve: {
    alias: [
      // The whole reason this works: RN primitives get a DOM implementation.
      { find: /^react-native$/, replacement: 'react-native-web' },
      // Native-only modules have no web build. Without stubs the test file
      // fails to import and you get a module error that looks nothing like
      // the layout problem you were actually looking for.
      { find: /^@expo\/ui(\/.*)?$/, replacement: stubs },
      // Ships untranspiled JSX in its `build/*.js` files (relies on Metro),
      // which makes Vite's esbuild/rolldown optimizer choke with a parse
      // error before any screen renders. Confirmed against a real app using
      // @expo/vector-icons — every screen failed to even start rendering.
      { find: /^@expo\/vector-icons(\/.*)?$/, replacement: stubs },
      // Same failure, different package: untranspiled JSX in `build/*.js`, so
      // the optimizer dies with `PARSE_ERROR: Unexpected JSX expression`
      // before any screen renders. Confirmed on a real app. Any package whose
      // parse error names a file under `node_modules/…/build/` belongs here —
      // alias it, don't remove it from the app.
      { find: /^expo-linear-gradient$/, replacement: stubs },
      // Screens are rendered on their own, with no navigator mounted above
      // them, so router internals have to be stood in for too.
      { find: /^expo-router(\/.*)?$/, replacement: stubs },
      { find: /^expo-status-bar$/, replacement: stubs },
      { find: /^expo-haptics$/, replacement: stubs },
      { find: /^expo-symbols$/, replacement: stubs },
      { find: /^expo-blur$/, replacement: stubs },
      { find: /^expo-camera$/, replacement: stubs },
      { find: /^expo-image$/, replacement: stubs },
      { find: /^expo-glass-effect$/, replacement: stubs },
      // Has a real web backend, but expo-modules-core's native-module bridge
      // is pulled in unconditionally along the way and references RN
      // internals (TurboModuleRegistry) react-native-web doesn't export —
      // breaks dependency optimization before any screen renders.
      { find: /^expo-audio$/, replacement: stubs },
      { find: /^expo-font$/, replacement: stubs },
      { find: /^expo-splash-screen$/, replacement: stubs },
      // These ship React Native *native component specs* written in Flow.
      // Vite's parser rejects Flow outright, so a single deep import of
      // `react-native/Libraries/…` from any of them kills the entire run
      // before a screen renders — which is what happens on a stock Expo
      // template, since the default scaffold uses safe-area-context.
      // Confirmed against a real SDK 57 scaffold.
      { find: /^react-native-safe-area-context$/, replacement: stubs },
      { find: /^react-native-screens(\/.*)?$/, replacement: stubs },
      { find: /^react-native-gesture-handler(\/.*)?$/, replacement: stubs },
      { find: /^react-native-reanimated(\/.*)?$/, replacement: stubs },
      // Anchored to `@/` exactly. A bare /^@/ would also match every scoped
      // package — @expo/ui, @react-native/…, @babel/… — and rewrite them
      // into nonsense paths.
      { find: /^@\//, replacement: srcRoot + '/' },
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  define: {
    __DEV__: 'true',
    'process.env.EXPO_OS': '"web"',
  },
  test: {
    root: projectRoot,
    // Literal leading dot in the pattern, so no `dot: true` glob flag needed.
    include: ['.claude/visual/tests/**/*.visual.test.tsx'],
    setupFiles: ['.claude/visual/setup.ts'],
    // Screenshots are slow; one retry absorbs a genuinely flaky render
    // without masking a real regression (a real one fails both times).
    retry: 1,
    testTimeout: 30_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          // iPhone 14/15 logical resolution — the narrow, common case. If it
          // fits here it fits on bigger phones; the reverse isn't true.
          viewport: { width: 390, height: 844 },
        },
      ],
      expect: {
        toMatchScreenshot: {
          comparatorName: 'pixelmatch',
          comparatorOptions: {
            threshold: 0.2,
            // 2%: absorbs font antialiasing jitter between runs on the same
            // machine, still catches any real layout shift (which moves far
            // more than 2% of pixels).
            allowedMismatchedPixelRatio: 0.02,
          },
        },
      },
    },
  },
});
