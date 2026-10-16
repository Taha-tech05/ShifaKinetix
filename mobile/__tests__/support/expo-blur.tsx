import { createElement } from 'react';
import type { ReactNode } from 'react';

// Blur stand-in for jest: renders a plain host element.
export const BlurView = (props: { children?: ReactNode } & Record<string, unknown>) => createElement('BlurView', props);
