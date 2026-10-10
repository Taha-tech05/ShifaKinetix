import { createElement } from 'react';
import type { ReactNode } from 'react';

// expo-router stand-in for jest: Redirect renders a host element so tests can see where it would go.
export const Redirect = (props: { href: string }) => createElement('Redirect', props);
export const router = { push: (_: string) => undefined, replace: (_: string) => undefined, back: () => undefined };
export const useLocalSearchParams = () => ({});
export const Link = (props: { children?: ReactNode }) => createElement('Link', props);
