/**
 * Web stand-ins for Expo modules that have no browser implementation.
 *
 * Two jobs:
 *  1. Let a screen that imports them render at all, instead of dying with a
 *     module-resolution error that hides the layout problem you were looking
 *     for.
 *  2. Reserve realistic space. A native control that renders as nothing would
 *     make the surrounding layout look fine in the check and broken on the
 *     phone — worse than not checking at all.
 *
 * Anything rendered from here is marked `data-native-stub`, and
 * layout-checks.ts skips those subtrees: their *contents* are not verified
 * (they aren't real), but their *box* participates in layout, so everything
 * around them still is.
 *
 * Named exports cannot be faked dynamically — ES modules resolve them at
 * transform time, so a screen importing something not listed below fails with
 * "does not provide an export named 'X'" in .claude/visual/last-run.json.
 * That message is the fix instruction: add the missing name here. Don't
 * chase it as a layout bug.
 *
 * DEFAULT imports get no such message, which is why the default export at the
 * bottom of this file is a callable component and not a plain object. A screen
 * doing `import Icon from '@expo/vector-icons/MaterialCommunityIcons'` binds
 * whatever the default is; if that's an object literal, React throws "Element
 * type is invalid… but got: object", which surfaces in last-run.json as a
 * locator timeout on `visual-root` — indistinguishable from a layout failure
 * unless you already know to look. Keep the default callable.
 */
import * as React from 'react';

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

function NativeStub(label: string, w = 120, h = 44) {
  const C = ({ children, ...rest }: AnyProps) =>
    React.createElement(
      'div',
      {
        'data-native-stub': label,
        style: {
          minWidth: w,
          minHeight: h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          border: '1px dashed #999',
          borderRadius: 8,
          color: '#666',
          font: '12px system-ui, sans-serif',
        },
        ...(rest as object),
      },
      (children as React.ReactNode) ?? label,
    );
  C.displayName = `NativeStub(${label})`;
  return C;
}

/**
 * A see-through container: renders its children in a flex column and takes no
 * space of its own. Used for wrappers whose whole job on a phone is insets or
 * gesture plumbing — SafeAreaView, GestureHandlerRootView, providers.
 *
 * These must NOT be NativeStub boxes. A stub would hide everything inside it
 * from the layout checks, which is the opposite of what's wanted: the content
 * of a SafeAreaView is exactly the content worth checking.
 */
function PassThrough(label: string) {
  const C = ({ children, style, ...rest }: AnyProps & { style?: unknown }) =>
    React.createElement(
      'div',
      { 'data-passthrough': label,
        style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
        ...(rest as object) },
      children as React.ReactNode,
    );
  C.displayName = `PassThrough(${label})`;
  return C;
}

// --- react-native-safe-area-context -----------------------------------------
// Insets are zero on purpose. A test viewport has no notch and no home
// indicator, and inventing insets would shift every screenshot away from what
// the geometry checks measured.
export const SafeAreaView = PassThrough('SafeAreaView');
export const SafeAreaProvider = PassThrough('SafeAreaProvider');
export const SafeAreaInsetsContext = React.createContext({ top: 0, bottom: 0, left: 0, right: 0 });
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 390, height: 844 });
export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

// --- react-native-screens / gesture-handler ---------------------------------
export const enableScreens = () => {};
export const enableFreeze = () => {};
export const ScreenContainer = PassThrough('ScreenContainer');
export const Screen = PassThrough('Screen');
export const GestureHandlerRootView = PassThrough('GestureHandlerRootView');
export const GestureDetector = PassThrough('GestureDetector');
// Swipe-to-delete rows. Pass-throughs, not stub boxes: the row *inside* a
// swipeable is exactly the content worth measuring, and a placeholder would
// hide it from the checks. `ReanimatedSwipeable` is the current API and is
// usually imported as a default from its own subpath — see the default export
// at the bottom of this file for why that matters.
export const Swipeable = PassThrough('Swipeable');
export const ReanimatedSwipeable = PassThrough('ReanimatedSwipeable');
export const Gesture = {
  Pan: () => ({ onUpdate: () => Gesture.Pan(), onEnd: () => Gesture.Pan() }),
  Tap: () => ({ onEnd: () => Gesture.Tap() }),
};

// --- react-native-reanimated ------------------------------------------------
// vitest.config.ts aliases this package here, but nothing answered for it, so
// any screen doing `import Animated, { useSharedValue } from
// 'react-native-reanimated'` failed to IMPORT — not to render. A suite-level
// import error produces zero failing *tests*, so the screen was silently never
// checked while the run still looked like a layout problem. Confirmed on a
// real three-screen app: the one screen with a spring animation was the only
// one never validated, and nothing said so.
//
// Everything here is deliberately inert. Animations are a fidelity concern and
// this harness measures geometry; what matters is that the component tree
// renders at its resting layout, which is exactly what a no-op timing function
// and an identity style give you.
const AnimatedView = PassThrough('Animated.View');

function makeAnimated(label: string) {
  return PassThrough(`Animated.${label}`);
}

export const useSharedValue = <T,>(initial: T) => ({ value: initial });
export const useDerivedValue = <T,>(fn: () => T) => ({ value: fn() });
export const useAnimatedStyle = (fn: () => object) => {
  try {
    return fn();
  } catch {
    // A worklet reading `.value` off something we didn't stub shouldn't take
    // the whole screen down — resting layout is still measurable without it.
    return {};
  }
};
export const useAnimatedRef = () => React.createRef();
export const useAnimatedScrollHandler = () => () => {};
export const useAnimatedGestureHandler = () => () => {};
// Timing/spring helpers return the target value directly: the resting state is
// what the layout checks should see.
export const withTiming = <T,>(to: T) => to;
export const withSpring = <T,>(to: T) => to;
export const withDelay = <T,>(_ms: number, to: T) => to;
export const withSequence = <T,>(...steps: T[]) => steps[steps.length - 1];
export const withRepeat = <T,>(anim: T) => anim;
export const cancelAnimation = () => {};
export const runOnJS = <F extends (...a: never[]) => unknown>(fn: F) => fn;
export const runOnUI = <F extends (...a: never[]) => unknown>(fn: F) => fn;
export const interpolate = (_v: number, _in: number[], out: number[]) => out[0] ?? 0;
export const interpolateColor = (_v: number, _in: number[], out: string[]) => out[0] ?? 'transparent';
export const Easing = {
  linear: (t: number) => t, ease: (t: number) => t, quad: (t: number) => t,
  cubic: (t: number) => t, bezier: () => (t: number) => t,
  in: (f: (t: number) => number) => f, out: (f: (t: number) => number) => f,
  inOut: (f: (t: number) => number) => f,
};
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
// Layout/entering/exiting animation builders. Chainable no-ops — screens use
// them as `FadeIn.duration(300).delay(100)`, and any missing link in that
// chain is another import-time crash.
const chainable = (): Record<string, unknown> =>
  new Proxy({}, { get: () => () => chainable() });
export const FadeIn = chainable();
export const FadeOut = chainable();
export const SlideInRight = chainable();
export const SlideOutLeft = chainable();
export const Layout = chainable();
export const LinearTransition = chainable();

// --- expo-glass-effect ------------------------------------------------------
// Aliased in vitest.config.ts with nothing behind it, same failure shape.
export const GlassView = PassThrough('GlassView');
export const GlassContainer = PassThrough('GlassContainer');
export const isLiquidGlassAvailable = () => false;

// --- expo-font / expo-splash-screen -----------------------------------------
export const useFonts = () => [true, null] as const;
export const loadAsync = async () => {};
export const isLoaded = () => true;
export const preventAutoHideAsync = async () => {};
export const hideAsync = async () => {};
export const setOptions = () => {};

// --- @expo/vector-icons -------------------------------------------------
// Sized to the `size` prop so icons inline correctly (chevrons in a row,
// glyphs inside a round button) instead of the default 120x44 box, which
// would blow up small inline layouts.
function IconStub(label: string) {
  const C = ({ size = 24, style, ...rest }: AnyProps & { size?: number; style?: unknown }) =>
    React.createElement('span', {
      'data-native-stub': label,
      style: { display: 'inline-block', width: size, height: size, ...(style as object) },
      ...(rest as object),
    });
  C.displayName = `IconStub(${label})`;
  return C;
}
export const Ionicons = IconStub('Ionicons');
export const MaterialIcons = IconStub('MaterialIcons');
export const MaterialCommunityIcons = IconStub('MaterialCommunityIcons');
export const FontAwesome = IconStub('FontAwesome');
export const FontAwesome5 = IconStub('FontAwesome5');
export const FontAwesome6 = IconStub('FontAwesome6');
export const AntDesign = IconStub('AntDesign');
export const Feather = IconStub('Feather');
export const Entypo = IconStub('Entypo');
export const EvilIcons = IconStub('EvilIcons');
export const Fontisto = IconStub('Fontisto');
export const Foundation = IconStub('Foundation');
export const Octicons = IconStub('Octicons');
export const SimpleLineIcons = IconStub('SimpleLineIcons');
export const Zocial = IconStub('Zocial');

// --- expo-linear-gradient ---------------------------------------------------
// A gradient is a *background*, so unlike SafeAreaView this one keeps the style
// it was handed instead of dropping it: the box is frequently real layout (a
// decorative band with an explicit height) and the children are real content.
// Neither a plain PassThrough nor a NativeStub is right — the first loses the
// height, the second hides the children.
export const LinearGradient = ({ children, style, ...rest }: AnyProps & { style?: unknown }) =>
  React.createElement(
    'div',
    {
      'data-passthrough': 'LinearGradient',
      style: { display: 'flex', flexDirection: 'column', ...(style as object) },
      ...(rest as object),
    },
    children as React.ReactNode,
  );

// --- expo-audio -----------------------------------------------------------
export const setAudioModeAsync = async () => {};
export const useAudioPlayer = () => ({
  play: () => {},
  pause: () => {},
  replace: () => {},
  seekTo: async () => {},
  playing: false,
  currentTime: 0,
  duration: 0,
});
export const useAudioPlayerStatus = () => ({ playing: false, currentTime: 0, duration: 0, isLoaded: true });

// --- concrete exports, sized like the real controls -------------------------
export const Host = NativeStub('Host', 200, 44);
export const Button = NativeStub('Button', 120, 44);
export const Switch = NativeStub('Switch', 51, 31);
export const Picker = NativeStub('Picker', 200, 44);
export const Slider = NativeStub('Slider', 200, 40);
export const DateTimePicker = NativeStub('DatePicker', 200, 44);
export const BottomSheet = NativeStub('BottomSheet', 390, 200);
export const ContextMenu = NativeStub('ContextMenu', 160, 44);
export const Section = NativeStub('Section', 358, 88);
export const Form = NativeStub('Form', 358, 120);
export const HStack = NativeStub('HStack', 358, 44);
export const VStack = NativeStub('VStack', 358, 88);
export const Text = NativeStub('Text', 80, 20);
export const Image = NativeStub('Image', 44, 44);
export const SymbolView = NativeStub('Symbol', 24, 24);
export const BlurView = NativeStub('Blur', 390, 100);
export const CameraView = NativeStub('Camera', 390, 520);

// expo-status-bar: renders nothing on web, occupies no space. Correct.
export const StatusBar = () => null;

// --- expo-router ------------------------------------------------------------
// Screens are rendered in isolation, with no navigator above them. These keep
// the common in-screen router usages from throwing. `Stack.Screen` renders
// nothing because on a device it only sets header options — it contributes no
// layout of its own, so omitting it keeps the geometry honest.
const Noop = () => null;
Noop.displayName = 'RouterNoop';

type StackLike = (() => null) & { Screen: () => null };
const makeNavigator = (): StackLike => {
  const N = (() => null) as StackLike;
  N.Screen = Noop;
  return N;
};
export const Stack = makeNavigator();
export const Tabs = makeNavigator();
export const Slot = Noop;
export const Redirect = Noop;
export const Link = ({ children, ...rest }: AnyProps) =>
  React.createElement('a', { role: 'link', tabIndex: 0, href: '#', ...(rest as object) }, children as React.ReactNode);
export const router = {
  push: () => {}, replace: () => {}, back: () => {},
  navigate: () => {}, dismiss: () => {}, canGoBack: () => false,
};
export const useRouter = () => router;
export const useLocalSearchParams = () => ({});
export const useGlobalSearchParams = () => ({});
export const useSegments = () => [] as string[];
export const usePathname = () => '/';
export const useNavigation = () => ({ setOptions: () => {}, navigate: () => {}, goBack: () => {} });
export const useFocusEffect = (cb: () => void) => { React.useEffect(() => { cb(); }, []); };

// expo-haptics: fire-and-forget side effects, safe to no-op.
export const impactAsync = async () => {};
export const notificationAsync = async () => {};
export const selectionAsync = async () => {};
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' } as const;
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' } as const;

// expo-camera permission hooks — always "granted" so the screen renders its
// real content instead of its permission-prompt branch.
export const useCameraPermissions = () =>
  [{ granted: true, status: 'granted' }, async () => ({ granted: true })] as const;

/**
 * Default export, for modules imported as `import X from '…'`.
 *
 * This MUST be callable. An object literal here renders nothing and reports
 * nothing: React throws "Element type is invalid… but got: object", which
 * reaches last-run.json as a locator timeout on `visual-root` and reads like a
 * layout failure. Two ordinary imports hit it in a single real build —
 *
 *   import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
 *   import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
 *
 * — and those two want opposite shapes. An icon wants an inline glyph sized to
 * its `size` prop; a swipeable wants a transparent wrapper whose children are
 * the part worth measuring. Either fixed choice gets the other badly wrong: a
 * `flex: 1` wrapper standing in for an icon expands to fill its row, and an
 * inline glyph standing in for a swipeable hides the row inside it.
 *
 * So it branches on what it is handed — children means wrapper, no children
 * means glyph — and carries the named exports as properties so `<X.Button />`
 * keeps working alongside `<X />`.
 */
const DefaultStub = ({
  children,
  size = 24,
  style,
  ...rest
}: AnyProps & { size?: number; style?: unknown }) =>
  children != null
    ? React.createElement(
        'div',
        {
          'data-passthrough': 'DefaultStub',
          style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
          ...(rest as object),
        },
        children as React.ReactNode,
      )
    : React.createElement('span', {
        'data-native-stub': 'DefaultStub',
        style: { display: 'inline-block', width: size, height: size, ...(style as object) },
        ...(rest as object),
      });
DefaultStub.displayName = 'DefaultStub';

export default Object.assign(DefaultStub, {
  Host, Button, Switch, Picker, Slider, DateTimePicker, BottomSheet,
  ContextMenu, Section, Form, HStack, VStack, Text, Image, SymbolView,
  BlurView, CameraView, StatusBar, LinearGradient,
  Swipeable, ReanimatedSwipeable,
  impactAsync, notificationAsync, selectionAsync,
  ImpactFeedbackStyle, NotificationFeedbackType,
  // Reanimated's default export is `Animated`, and every alias in
  // vitest.config.ts lands on this one file — so `import Animated from
  // 'react-native-reanimated'` arrives here. Without these properties
  // `<Animated.View>` is `undefined` and React throws "Element type is
  // invalid" at import time, taking the whole screen out of the check set.
  View: AnimatedView,
  ScrollView: makeAnimated('ScrollView'),
  FlatList: makeAnimated('FlatList'),
  // `Animated.Text`/`Animated.Image` intentionally reuse the @expo/ui stubs
  // above — same name, same job, and duplicating them would drift.
  createAnimatedComponent: <C,>(Component: C) => Component,
  addWhitelistedNativeProps: () => {},
  addWhitelistedUIProps: () => {},
});
