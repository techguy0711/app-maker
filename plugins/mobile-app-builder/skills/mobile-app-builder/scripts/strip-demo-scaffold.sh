#!/usr/bin/env bash
# Strips the demo tabs/explore/modal content that every create-expo-app
# default template ships (built to show off features, not to be part of
# the user's app) and replaces it with a single-screen stack layout, ready
# for the real screen to be written on top.
#
# WHY THIS EXISTS: this exact cleanup — read the template's _layout.tsx,
# work out its shape, grep-confirm what's safe to delete, delete it, rewrite
# _layout.tsx to a plain single-screen Stack, write a placeholder
# index.tsx — has been done by hand twice (once per SDK template shape
# encountered) and worked both times. Making it a script removes the
# chance of missing a file or leaving a dangling import, and is faster.
#
# WHAT IT DOES NOT DO: guess. create-expo-app's default template layout
# changes shape between SDK releases (confirmed: SDK 57's template used
# `src/app/` + NativeTabs + a different theme.ts shape than SDK 54's
# `app/(tabs)/` + classic Tabs). This script only acts on the two shapes
# seen and tested so far. If it doesn't recognize the project's layout, it
# says so and exits without touching anything — do the cleanup by hand
# following the same read-decide-grep-delete-verify process described in
# build-flow/phase-2-scaffold.md, then consider teaching this script the new shape.
#
# Usage: strip-demo-scaffold.sh [--name "Display Name"]
# Run from inside the project root (after cd <app-name>).

set -euo pipefail

DISPLAY_NAME=""
if [ "${1:-}" = "--name" ]; then
  DISPLAY_NAME="${2:?--name requires a value}"
fi

abort() {
  echo "[ABORT] $1" >&2
  echo "Nothing was changed. Fall back to the manual process in build-flow/phase-2-scaffold.md." >&2
  exit 1
}

if [ ! -f "app.json" ] && [ ! -f "package.json" ]; then
  abort "Doesn't look like an Expo project root (no app.json/package.json here)."
fi

PROFILE=""
if [ -f "app/(tabs)/_layout.tsx" ]; then
  PROFILE="classic-tabs"
elif [ -f "src/app/_layout.tsx" ] && [ -f "src/components/app-tabs.tsx" ]; then
  PROFILE="native-tabs"
else
  abort "Unrecognized template layout — this script only knows the 'app/(tabs)/' (SDK ~54) and 'src/app/' + app-tabs.tsx (SDK ~57) shapes seen in testing so far."
fi

echo "Detected template profile: $PROFILE"

grep_check() {
  # $1 = pattern, $2.. = search dirs. Aborts if the pattern shows up outside
  # the exact files we're about to delete or overwrite (DELETE_FILES /
  # OVERWRITE_FILES globals) — either is fine, since overwritten files get
  # their entire contents replaced regardless of what they import today.
  local pattern="$1"; shift
  local hits
  hits="$(grep -rl "$pattern" "$@" 2>/dev/null || true)"
  for f in $hits; do
    local known=0
    for d in "${DELETE_FILES[@]}" "${OVERWRITE_FILES[@]}"; do
      [ "$f" = "$d" ] && known=1 && break
    done
    if [ "$known" -eq 0 ]; then
      abort "'$pattern' is referenced in '$f', which isn't one of the files this script plans to delete or overwrite — the template may have changed shape. Not deleting anything."
    fi
  done
}

if [ "$PROFILE" = "classic-tabs" ]; then
  DELETE_FILES=(
    "app/(tabs)/_layout.tsx" "app/(tabs)/index.tsx" "app/(tabs)/explore.tsx"
    "app/modal.tsx"
    "components/external-link.tsx" "components/haptic-tab.tsx"
    "components/hello-wave.tsx" "components/parallax-scroll-view.tsx"
    "components/ui/collapsible.tsx" "components/ui/icon-symbol.tsx"
    "components/ui/icon-symbol.ios.tsx"
  )
  OVERWRITE_FILES=("app/_layout.tsx" "app/index.tsx")
  for pat in "external-link" "ExternalLink" "hello-wave" "HelloWave" \
             "parallax-scroll-view" "ParallaxScrollView" "haptic-tab" "HapticTab" \
             "icon-symbol" "IconSymbol" "collapsible" "Collapsible"; do
    grep_check "$pat" app components
  done

  rm -rf "app/(tabs)" app/modal.tsx
  for f in "components/external-link.tsx" "components/haptic-tab.tsx" \
           "components/hello-wave.tsx" "components/parallax-scroll-view.tsx" \
           "components/ui/collapsible.tsx" "components/ui/icon-symbol.tsx" \
           "components/ui/icon-symbol.ios.tsx"; do
    rm -f "$f"
  done

  cat > app/_layout.tsx <<'EOF'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
EOF

  cat > app/index.tsx <<'EOF'
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Edit app/index.tsx to build your app</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24 },
});
EOF

elif [ "$PROFILE" = "native-tabs" ]; then
  # animated-icon.* renders Expo's own logo as an animated splash overlay —
  # confirmed present in a real SDK 57 scaffold after this script ran, and it
  # has no business surviving into a user's actual app. Delete it along with
  # the rest of the demo content, not just the tabs.
  DELETE_FILES=(
    "src/app/explore.tsx"
    "src/components/app-tabs.tsx" "src/components/app-tabs.web.tsx"
    "src/components/hint-row.tsx" "src/components/web-badge.tsx"
    "src/components/external-link.tsx" "src/components/ui/collapsible.tsx"
    "src/components/animated-icon.tsx" "src/components/animated-icon.web.tsx"
    "src/components/animated-icon.module.css"
  )
  OVERWRITE_FILES=("src/app/_layout.tsx" "src/app/index.tsx")
  for pat in "app-tabs" "AppTabs" "hint-row" "HintRow" "web-badge" "WebBadge" \
             "external-link" "ExternalLink" "collapsible" "Collapsible" \
             "animated-icon" "AnimatedSplashOverlay" "AnimatedIcon"; do
    grep_check "$pat" src
  done

  rm -f "${DELETE_FILES[@]}"
  rm -rf assets/images/tabIcons

  cat > src/app/_layout.tsx <<'EOF'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
EOF

  cat > src/app/index.tsx <<'EOF'
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Edit src/app/index.tsx to build your app</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', flexDirection: 'row' },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24 },
});
EOF

  # This template ships CSS imports (global.css, animated-icon.module.css)
  # with no ambient type declarations for them, which fails `tsc --noEmit`
  # out of the box regardless of anything this script touches — confirmed
  # pre-existing in the stock template, not caused by this cleanup. Fix it
  # so the project verifies clean immediately, same as the classic-tabs
  # profile does without any extra step.
  if [ ! -f "src/css.d.ts" ]; then
    cat > src/css.d.ts <<'EOF'
declare module '*.css';
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
EOF
  fi
fi

if [ -n "$DISPLAY_NAME" ] && [ -f "app.json" ]; then
  node -e "
const fs = require('fs');
const path = 'app.json';
const json = JSON.parse(fs.readFileSync(path, 'utf8'));
json.expo.name = process.argv[1];
fs.writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
" "$DISPLAY_NAME"
  echo "Set app.json display name to: $DISPLAY_NAME"
fi

echo ""
echo "Demo scaffold stripped ($PROFILE profile). Now run 'npx tsc --noEmit' to"
echo "confirm, then replace the placeholder screen with the real one."
