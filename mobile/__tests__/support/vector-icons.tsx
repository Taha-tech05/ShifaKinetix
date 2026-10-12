import { createElement } from 'react';

// Icon stand-in for jest: renders a plain host element.
export const Ionicons = (props: Record<string, unknown>) => createElement('Ionicons', props);
(Ionicons as unknown as { glyphMap: Record<string, number> }).glyphMap = {};
