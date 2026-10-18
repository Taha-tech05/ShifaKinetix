import { createElement } from 'react';
import type { ReactNode } from 'react';

// react-native-reanimated stand-in for jest: animated views are plain views, animations resolve at once.
const View = (props: { children?: ReactNode } & Record<string, unknown>) => createElement('Animated.View', props);
export default { View };
export const useSharedValue = <T,>(v: T) => ({ value: v });
export const useAnimatedStyle = (f: () => object) => f();
export const withTiming = <T,>(v: T) => v;
export const withDelay = <T,>(_d: number, v: T) => v;
export const withRepeat = <T,>(v: T) => v;
export const withSequence = <T,>(...v: T[]) => v[v.length - 1];
