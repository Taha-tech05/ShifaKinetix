import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { useSettings } from '../store/settings';
import { colors, typography } from '../theme';

type Props = TextProps & {
  variant?: keyof typeof typography;
  color?: string;
};

/** Urdu (Nastaliq-style) text needs more room above and below the line than Latin text, or its tall marks are cut off. */
export const URDU_LINE_HEIGHT = 1.35;

/** Themed text. Alignment is left to the layout so RTL mirrors by itself. */
export function AppText({ variant = 'body', color = colors.ink, style, ...rest }: Props) {
  const urdu = useSettings((s) => s.language) === 'ur';
  const base = typography[variant];
  return <Text {...rest} style={[base, urdu ? { lineHeight: Math.round(base.lineHeight * URDU_LINE_HEIGHT) } : null, { color }, style]} />;
}
