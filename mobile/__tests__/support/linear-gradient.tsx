import { createElement } from 'react';
import type { ReactNode } from 'react';

// Gradient stand-in for jest: renders a plain host element with its children.
export const LinearGradient = (props: { children?: ReactNode } & Record<string, unknown>) => createElement('LinearGradient', props);
