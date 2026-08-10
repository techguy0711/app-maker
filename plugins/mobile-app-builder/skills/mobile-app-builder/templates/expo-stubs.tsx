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
export const Gesture = {
  Pan: () => ({ onUpdate: () => Gesture.Pan(), onEnd: () => Gesture.Pan() }),
  Tap: () => ({ onEnd: () => Gesture.Tap() }),
};

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

// Default export, for modules imported as `import X from 'expo-...'`.
export default {
  Host, Button, Switch, Picker, Slider, DateTimePicker, BottomSheet,
  ContextMenu, Section, Form, HStack, VStack, Text, Image, SymbolView,
  BlurView, CameraView, StatusBar,
  impactAsync, notificationAsync, selectionAsync,
  ImpactFeedbackStyle, NotificationFeedbackType,
};
