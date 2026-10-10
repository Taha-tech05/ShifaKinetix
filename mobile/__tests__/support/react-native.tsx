// Minimal react-native stand-in so component tests run under plain ts-jest (no native runtime).
import { createElement } from 'react';
import type { ReactNode } from 'react';

const host = (name: string) => (props: { children?: ReactNode } & Record<string, unknown>) =>
  createElement(name, props);

export const View = host('View');
export const Text = host('Text');
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
