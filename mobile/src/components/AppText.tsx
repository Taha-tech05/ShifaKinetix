import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { colors, typography } from '../theme';

type Props = TextProps & {
  variant?: keyof typeof typography;
  color?: string;
};

/** Themed text. Alignment is left to the layout so RTL mirrors by itself. */
export function AppText({ variant = 'body', color = colors.ink, style, ...rest }: Props) {
  return <Text {...rest} style={[typography[variant], { color }, style]} />;
}
