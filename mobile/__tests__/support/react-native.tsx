// Minimal react-native stand-in so component tests run under plain ts-jest (no native runtime).
import { createElement } from 'react';
import type { ReactNode } from 'react';

const host = (name: string) => (props: { children?: ReactNode } & Record<string, unknown>) =>
  createElement(name, props);

export const View = host('View');
export const Text = host('Text');
export const TextInput = host('TextInput');
export const Pressable = host('Pressable');
export const ScrollView = host('ScrollView');
export const Modal = host('Modal');
export const StyleSheet = { create: <T,>(s: T) => s, flatten: (s: unknown) => s };

let rtl = false;
export const I18nManager = {
  get isRTL() {
    return rtl;
  },
  allowRTL: (_v: boolean) => undefined,
  forceRTL: (v: boolean) => {
    rtl = v;
  },
};
export const Linking = { openURL: async (_url: string) => undefined };

// back button, alert and accessibility settings, as no-ops that tests can replace
export const BackHandler = { addEventListener: (_name: string, _cb: () => boolean) => ({ remove: () => undefined }) };
export const Alert = { alert: (_title: string, _message?: string, _buttons?: { text: string; onPress?: () => void }[]) => undefined };
export const AccessibilityInfo = { isReduceMotionEnabled: async () => false };
export const LogBox = { ignoreLogs: (_l: string[]) => undefined };

// used by the UI layer (ui/): platform check for the blur fallback and the system colour scheme
export const Platform = { OS: 'android' as const, select: <T,>(o: { android?: T; default?: T }) => o.android ?? o.default };
export const useColorScheme = () => 'light' as const;
