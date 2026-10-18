import { createElement } from 'react';
import type { ReactNode } from 'react';

// react-native-reanimated stand-in for jest: animated views are plain views, animations resolve at once.
const View = (props: { children?: ReactNode } & Record<string, unknown>) => createElement('Animated.View', props);
const Text = (props: { children?: ReactNode } & Record<string, unknown>) => createElement('Animated.Text', props);
// layout animations (entering/exiting) are plain no-ops in tests
const layoutAnim: Record<string, unknown> = {};
const chain = new Proxy(layoutAnim, { get: (_t, k) => (k === 'then' ? undefined : () => chain) });
export default { View, Text, createAnimatedComponent: <T,>(c: T) => c };
export const FadeIn = chain;
export const FadeInDown = chain;
export const FadeInUp = chain;
export const FadeInRight = chain;
export const Easing = { out: (f: unknown) => f, in: (f: unknown) => f, inOut: (f: unknown) => f, cubic: (x: number) => x, ease: (x: number) => x };
export const useSharedValue = <T,>(v: T) => ({ value: v });
export const useAnimatedStyle = (f: () => object) => f();
export const withTiming = <T,>(v: T) => v;
export const withDelay = <T,>(_d: number, v: T) => v;
export const withRepeat = <T,>(v: T) => v;
export const withSequence = <T,>(...v: T[]) => v[v.length - 1];
